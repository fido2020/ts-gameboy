(() => {
  // src/memory.ts
  var GB_INTERNAL_MEM_SZ = 8 * 4096;
  var GB_COLOR_INTERNAL_MEM_SZ = 32 * 4096;
  var GB_INTERNAL_VMEM_SZ = 8 * 4096;
  var GB_COLOR_INTERNAL_VMEM_SZ = 16 * 4096;
  var GB_ROM_BANK_SZ = 4 * 4096;
  var GB_SPRITE_PATTERN_TABLE = 32768;
  var GB_BG_TILEMAP = 38912;
  var GB_SPRITE_COUNT = 40;
  var Memory = class {
    constructor() {
      this.rom_bank0 = new Uint8Array(GB_ROM_BANK_SZ);
      this.internal_mem = new Uint8Array(GB_INTERNAL_MEM_SZ);
      this.video_mem = new Uint8Array(GB_INTERNAL_VMEM_SZ);
      this.sprite_mem = new Array(GB_SPRITE_COUNT);
      this.sprite_mem.fill({ x: 0, y: 0, patternNum: 0, flags: 0 });
    }
    write_byte(address, value) {
      if (address < 16384) {
        9;
      } else if (address < 32768) {
      } else if (address < 40960) {
        console.log("writing to: " + address.toString(16));
        this.video_mem[address - 32768] = value;
      } else if (address < 49152) {
      } else if (address < 57344) {
        this.internal_mem[address - 49152] = value;
      } else if (address < 65024) {
        this.internal_mem[address - 57344] = value;
      } else if (address < 65184) {
        let index = (address & 255) >>> 2;
        let field = address & 3;
        console.log("writing to OAM at: " + address.toString(16) + ", index: " + index.toString());
        switch (field) {
          case 0:
            this.sprite_mem[index].x = value;
            break;
          case 1:
            this.sprite_mem[index].y = value;
            break;
          case 2:
            this.sprite_mem[index].patternNum = value;
            break;
          case 3:
            this.sprite_mem[index].flags = value;
            break;
        }
      } else if (65280 <= address && address < 65356) {
      } else if (address >= 65408 && address < 65535) {
      } else if (address == 65535) {
        this.int_enable = value;
      }
    }
    read_byte(address) {
      if (address < 16384) {
        return this.rom_bank0[address];
      } else if (address < 32768) {
        return 255;
      } else if (address < 40960) {
        return this.video_mem[address - 32768];
      } else if (address < 49152) {
        return 255;
      } else if (address < 57344) {
        return this.internal_mem[address - 49152];
      } else if (address < 65024) {
        return this.internal_mem[address - 57344];
      } else if (address < 65184) {
        let index = address >> 2 & 63;
        let field = address & 3;
        switch (field) {
          case 0:
            return this.sprite_mem[index].x;
          case 1:
            return this.sprite_mem[index].y;
          case 2:
            return this.sprite_mem[index].patternNum;
          case 3:
            return this.sprite_mem[index].flags;
        }
      } else if (65280 <= address && address < 65356) {
        return 255;
      } else if (address >= 65408 && address < 65535) {
        return 255;
      } else {
        return 255;
      }
    }
    write_word(address, value) {
      this.write_byte(address, value & 255);
      this.write_byte(address + 1, value >> 8);
    }
    read_word(address) {
      return this.read_byte(address) | this.read_byte(address + 1) << 8;
    }
  };

  // src/display.ts
  var Display = class {
    constructor(mem2) {
      this.mem = mem2;
      this.canvas = document.getElementById("display");
      this.ctx = this.canvas.getContext("2d");
      this.ctx.fillRect(0, 0, 100, 100);
    }
    draw_frame() {
      for (let i = 0; i < 100; i++) {
        this.draw_scanline(i);
      }
    }
    draw_scanline(index) {
      let firstTile = index / 8 * 32;
      for (let i = 0; i < 32; i++) {
        let tileIndex = firstTile + i;
        let tile = this.mem.read_byte(GB_BG_TILEMAP + tileIndex);
        let pattern1 = this.mem.read_byte(GB_SPRITE_PATTERN_TABLE + tileIndex * 16 + index % 8 * 2);
        let pattern2 = this.mem.read_byte(GB_SPRITE_PATTERN_TABLE + tileIndex * 16 + index % 8 * 2 + 1);
        for (let p = 0; p < 4; p++) {
          this.ctx.fillStyle = "#000000";
          if (pattern1 & 1 << p) {
            this.ctx.fillStyle = "#FFFFFF";
          }
          this.ctx.fillRect(i * 8 + p, index, 1, 1);
          this.ctx.fillStyle = "#000000";
          if (pattern2 & 1 << p) {
            this.ctx.fillStyle = "#FFFFFF";
          }
          this.ctx.fillRect(i * 8 + 4 + p, index, 1, 1);
        }
      }
    }
  };

  // src/cpu.ts
  var CPU = class {
    constructor(mem2) {
      this.pending_ints = 0;
      this.instr = new Array(255);
      this.mem = mem2;
      this.initialize_instr();
      this.initialize();
    }
    initialize() {
      this.r_pc = 256;
      this.r_a = 0;
      this.r_b = 0;
      this.r_c = 0;
      this.r_d = 0;
      this.r_e = 0;
      this.r_h = 0;
      this.r_l = 0;
      this.r_sp = 0;
      this.r_f = 0;
      this.pending_ints = 0;
    }
    run() {
      let interrupts = this.mem.interrupt_flag & this.pending_ints;
      if (this.mem.int_enable && interrupts) {
        if (interrupts & 1 /* VBlank */) {
          this.handle_interrupt(64 /* VBlank */);
        } else if (interrupts & 2 /* LCDCStatus */) {
          this.handle_interrupt(72 /* LCDCStatus */);
        } else if (interrupts & 4 /* TimerOverflow */) {
          this.handle_interrupt(80 /* TimerOverflow */);
        } else if (interrupts & 8 /* SerialTransfer */) {
          this.handle_interrupt(88 /* SerialTransfer */);
        } else if (interrupts & 16 /* Joypad */) {
          this.handle_interrupt(96 /* Joypad */);
        }
      }
      let opcode = this.mem.read_byte(this.r_pc);
      this.pc_inc(1);
      console.log(`pc: ${this.r_pc.toString(16)}, op: ${opcode.toString(16)}`);
      let op = this.instr[opcode];
      if (op == this.op_stub) {
        throw new Error(`Unimplemented opcode: ${opcode}`);
      }
      op.call(this);
    }
    handle_interrupt(irq) {
      this.sp_inc(-2);
      this.mem.write_word(this.r_sp, this.r_pc);
      this.r_pc = irq;
      this.mem.int_enable = 0;
    }
    send_interrupt(irq) {
      switch (irq) {
        case 64 /* VBlank */:
          this.pending_ints |= 1 /* VBlank */;
          break;
        case 72 /* LCDCStatus */:
          this.pending_ints |= 2 /* LCDCStatus */;
          break;
        case 88 /* SerialTransfer */:
          this.pending_ints |= 8 /* SerialTransfer */;
          break;
        case 80 /* TimerOverflow */:
          this.pending_ints |= 4 /* TimerOverflow */;
          break;
        case 96 /* Joypad */:
          this.pending_ints |= 16 /* Joypad */;
          break;
        default:
          throw new Error("Unknown interrupt!");
      }
    }
    pc_inc(n) {
      this.r_pc = this.r_pc + n & 65535;
    }
    sp_inc(n) {
      this.r_sp = this.r_sp + n & 65535;
    }
    alu_perform_add(l, r) {
      let low = (l & 15) + (r & 15);
      this.r_f = 0;
      if (low & 16) {
        this.r_f |= 32 /* H */;
      }
      let high = (l >> 8 & 15) + (r >> 8 & 15);
      if (high & 16) {
        this.r_f |= 16 /* C */;
      }
      let result = low + high & 255;
      if (result == 0) {
        this.r_f |= 128 /* Z */;
      }
      return result;
    }
    alu_perform_sub(l, r) {
      let low = (l & 15) - (r & 15);
      this.r_f = 0;
      if (low & 16) {
        this.r_f |= 32 /* H */;
      }
      let high = (l >> 8 & 15) - (r >> 8 & 15);
      if (high & 16) {
        this.r_f |= 16 /* C */;
      }
      let result = l - r & 255;
      if (result == 0) {
        this.r_f |= 128 /* Z */;
      }
      return result;
    }
    alu_perform_inc(v) {
      let low = (v & 15) + 1;
      this.r_f = this.r_f & 16 /* C */;
      if (low & 16) {
        this.r_f |= 32 /* H */;
      }
      let result = low + (v & 240);
      return result & 255;
    }
    alu_perform_dec(v) {
      let low = (v & 15) - 1;
      this.r_f = this.r_f & 16 /* C */ | 64 /* N */;
      if (low & 16) {
        this.r_f |= 32 /* H */;
      }
      let result = low + (v & 240);
      return result & 255;
    }
    alu_perform_add_carry(l, r) {
      let low = (l & 15) + (l & 15);
      if (this.r_f & 16 /* C */) {
        low += 1;
      }
      this.r_f = 0;
      if (low & 16) {
        this.r_f |= 32 /* H */;
      }
      let high = (l >> 8 & 15) + (r >> 8 & 15);
      if (high & 16) {
        this.r_f |= 16 /* C */;
      }
      let result = low + high & 255;
      if (result == 0) {
        this.r_f |= 128 /* Z */;
      }
      return result;
    }
    op_stub() {
    }
    op_nop() {
    }
    op_di() {
    }
    op_ei() {
    }
    op_rst_00() {
      this.r_pc = 0;
    }
    op_rst_08() {
      this.r_pc = 8;
    }
    op_rst_10() {
      this.r_pc = 16;
    }
    op_rst_18() {
      this.r_pc = 24;
    }
    op_rst_20() {
      this.r_pc = 32;
    }
    op_rst_28() {
      this.r_pc = 40;
    }
    op_rst_30() {
      this.r_pc = 48;
    }
    op_rst_38() {
      this.r_pc = 56;
    }
    // 16-bit
    op_ld_bc_nn() {
      let v = this.mem.read_word(this.r_pc);
      this.pc_inc(2);
      this.r_bc = v;
    }
    op_ld_de_nn() {
      let v = this.mem.read_word(this.r_pc);
      this.pc_inc(2);
      this.r_de = v;
    }
    op_ld_hl_nn() {
      let v = this.mem.read_word(this.r_pc);
      this.pc_inc(2);
      this.r_hl = v;
    }
    op_ld_sp_nn() {
      let v = this.mem.read_word(this.r_pc);
      this.pc_inc(2);
      this.r_sp = v;
    }
    op_ld_sp_hl() {
      this.r_sp = this.r_hl;
    }
    op_ld_hl_sp_n() {
      let n = this.mem.read_byte(this.r_pc);
      this.pc_inc(1);
      this.r_hl = this.r_sp + n & 65535;
      this.alu_perform_add(this.r_sp & 255, n);
      this.r_f &= 16 /* C */ | 32 /* H */;
    }
    op_ldd_m_hl_a() {
      this.op_ld_m_hl_a();
      this.r_hl = this.r_hl - 1 & 65535;
    }
    op_ldi_a_m_hl() {
      this.op_ld_a_m_hl();
      this.r_hl = this.r_hl + 1 & 65535;
    }
    // Save SP at immediate address
    op_ld_m_nn_sp() {
      let addr = this.mem.read_word(this.r_pc);
      this.pc_inc(2);
      this.mem.write_word(addr, this.r_sp);
    }
    // 16-bit arithmetic
    op_inc_bc() {
      this.r_bc = this.r_bc + 1 & 65535;
    }
    op_inc_de() {
      this.r_de = this.r_de + 1 & 65535;
    }
    op_inc_hl() {
      this.r_hl = this.r_hl + 1 & 65535;
    }
    op_inc_sp() {
      this.r_sp = this.r_sp + 1 & 65535;
    }
    op_add_hl_bc() {
      this.r_hl = this.r_hl + this.r_bc & 65535;
      let fl = this.r_f & 128 /* Z */;
      this.alu_perform_add(this.r_l, this.r_c);
      this.r_f = fl | this.r_f & (16 /* C */ | 32 /* H */);
    }
    op_add_hl_de() {
      this.r_hl = this.r_hl + this.r_de & 65535;
      let fl = this.r_f & 128 /* Z */;
      this.alu_perform_add(this.r_l, this.r_e);
      this.r_f = fl | this.r_f & (16 /* C */ | 32 /* H */);
    }
    op_add_hl_hl() {
      this.r_hl = this.r_hl + this.r_hl & 65535;
      let fl = this.r_f & 128 /* Z */;
      this.alu_perform_add(this.r_l, this.r_l);
      this.r_f = fl | this.r_f & (16 /* C */ | 32 /* H */);
    }
    op_add_hl_sp() {
      this.r_hl = this.r_hl + this.r_sp & 65535;
      let fl = this.r_f & 128 /* Z */;
      this.alu_perform_add(this.r_l, this.r_sp >> 8);
      this.r_f = fl | this.r_f & (16 /* C */ | 32 /* H */);
    }
    // Stack tings
    op_push_af() {
      this.sp_inc(-2);
      this.mem.write_word(this.r_sp, this.r_af);
    }
    op_push_bc() {
      this.sp_inc(-2);
      this.mem.write_word(this.r_sp, this.r_bc);
    }
    op_push_de() {
      this.sp_inc(-2);
      this.mem.write_word(this.r_sp, this.r_de);
    }
    op_push_hl() {
      this.sp_inc(-2);
      this.mem.write_word(this.r_sp, this.r_hl);
    }
    op_pop_af() {
      this.r_af = this.mem.read_word(this.r_sp);
      this.sp_inc(2);
    }
    op_pop_bc() {
      this.r_bc = this.mem.read_word(this.r_sp);
      this.sp_inc(2);
    }
    op_pop_de() {
      this.r_de = this.mem.read_word(this.r_sp);
      this.sp_inc(2);
    }
    op_pop_hl() {
      this.r_hl = this.mem.read_word(this.r_sp);
      this.sp_inc(2);
    }
    // CALL instructions
    op_call_nn() {
      let addr = this.mem.read_word(this.r_pc);
      this.pc_inc(2);
      this.sp_inc(-2);
      this.mem.write_word(this.r_sp, this.r_pc);
      this.r_pc = addr;
    }
    op_call_nz_nn() {
      let addr = this.mem.read_word(this.r_pc);
      this.pc_inc(2);
      if (~this.r_f & 128 /* Z */) {
        this.sp_inc(-2);
        this.mem.write_word(this.r_sp, this.r_pc);
        this.r_pc = addr;
      }
    }
    op_call_z_nn() {
      let addr = this.mem.read_word(this.r_pc);
      this.pc_inc(2);
      if (this.r_f & 128 /* Z */) {
        this.sp_inc(-2);
        this.mem.write_word(this.r_sp, this.r_pc);
        this.r_pc = addr;
      }
    }
    op_call_nc_nn() {
      let addr = this.mem.read_word(this.r_pc);
      this.pc_inc(2);
      if (~this.r_f & 16 /* C */) {
        this.sp_inc(-2);
        this.mem.write_word(this.r_sp, this.r_pc);
        this.r_pc = addr;
      }
    }
    op_call_c_nn() {
      let addr = this.mem.read_word(this.r_pc);
      this.pc_inc(2);
      if (this.r_f & 16 /* C */) {
        this.sp_inc(-2);
        this.mem.write_word(this.r_sp, this.r_pc);
        this.r_pc = addr;
      }
    }
    op_ret() {
      this.r_pc = this.mem.read_word(this.r_sp);
      this.sp_inc(2);
    }
    op_reti() {
      this.r_pc = this.mem.read_word(this.r_sp);
      this.sp_inc(2);
      this.mem.int_enable = 1;
    }
    op_ret_nz() {
      if (~this.r_f & 128 /* Z */) {
        this.r_pc = this.mem.read_word(this.r_sp);
        this.sp_inc(2);
      }
    }
    op_ret_z() {
      if (this.r_f & 128 /* Z */) {
        this.r_pc = this.mem.read_word(this.r_sp);
        this.sp_inc(2);
      }
    }
    op_ret_nc() {
      if (~this.r_f & 16 /* C */) {
        this.r_pc = this.mem.read_word(this.r_sp);
        this.sp_inc(2);
      }
    }
    op_ret_c() {
      if (this.r_f & 16 /* C */) {
        this.r_pc = this.mem.read_word(this.r_sp);
        this.sp_inc(2);
      }
    }
    // 8-bit
    op_ld_b_n() {
      let v = this.mem.read_byte(this.r_pc);
      this.pc_inc(1);
      this.r_b = v;
    }
    op_ld_c_n() {
      let v = this.mem.read_byte(this.r_pc);
      this.pc_inc(1);
      this.r_c = v;
    }
    op_ld_d_n() {
      let v = this.mem.read_byte(this.r_pc);
      this.pc_inc(1);
      this.r_d = v;
    }
    op_ld_e_n() {
      let v = this.mem.read_byte(this.r_pc);
      this.pc_inc(1);
      this.r_e = v;
    }
    op_ld_h_n() {
      let v = this.mem.read_byte(this.r_pc);
      this.pc_inc(1);
      this.r_h = v;
    }
    op_ld_l_n() {
      let v = this.mem.read_byte(this.r_pc);
      this.pc_inc(1);
      this.r_l = v;
    }
    op_ld_a_n() {
      let v = this.mem.read_byte(this.r_pc);
      this.pc_inc(1);
      this.r_a = v;
    }
    // LD a, r
    op_ld_a_a() {
    }
    op_ld_a_b() {
      this.r_a = this.r_b;
    }
    op_ld_a_c() {
      this.r_a = this.r_c;
    }
    op_ld_a_d() {
      this.r_a = this.r_d;
    }
    op_ld_a_e() {
      this.r_a = this.r_e;
    }
    op_ld_a_h() {
      this.r_a = this.r_h;
    }
    op_ld_a_l() {
      this.r_a = this.r_l;
    }
    op_ld_a_m_hl() {
      this.r_a = this.mem.read_byte(this.r_hl);
    }
    // LD b, r
    op_ld_b_b() {
    }
    op_ld_b_c() {
      this.r_b = this.r_c;
    }
    op_ld_b_d() {
      this.r_b = this.r_d;
    }
    op_ld_b_e() {
      this.r_b = this.r_e;
    }
    op_ld_b_h() {
      this.r_b = this.r_h;
    }
    op_ld_b_l() {
      this.r_b = this.r_l;
    }
    op_ld_b_m_hl() {
      this.r_b = this.mem.read_byte(this.r_hl);
    }
    op_ld_b_a() {
      this.r_b = this.r_a;
    }
    // LD c, r
    op_ld_c_b() {
      this.r_c = this.r_b;
    }
    op_ld_c_c() {
    }
    op_ld_c_d() {
      this.r_c = this.r_d;
    }
    op_ld_c_e() {
      this.r_c = this.r_e;
    }
    op_ld_c_h() {
      this.r_c = this.r_h;
    }
    op_ld_c_l() {
      this.r_c = this.r_l;
    }
    op_ld_c_m_hl() {
      this.r_c = this.mem.read_byte(this.r_hl);
    }
    op_ld_c_a() {
      this.r_c = this.r_a;
    }
    // LD d, r
    op_ld_d_b() {
      this.r_d = this.r_b;
    }
    op_ld_d_c() {
      this.r_d = this.r_c;
    }
    op_ld_d_d() {
    }
    op_ld_d_e() {
      this.r_d = this.r_e;
    }
    op_ld_d_h() {
      this.r_d = this.r_h;
    }
    op_ld_d_l() {
      this.r_d = this.r_l;
    }
    op_ld_d_m_hl() {
      this.r_d = this.mem.read_byte(this.r_hl);
    }
    op_ld_d_a() {
      this.r_d = this.r_a;
    }
    // LD e, r
    op_ld_e_b() {
      this.r_e = this.r_b;
    }
    op_ld_e_c() {
      this.r_e = this.r_c;
    }
    op_ld_e_d() {
      this.r_e = this.r_d;
    }
    op_ld_e_e() {
    }
    op_ld_e_h() {
      this.r_e = this.r_h;
    }
    op_ld_e_l() {
      this.r_e = this.r_l;
    }
    op_ld_e_m_hl() {
      this.r_e = this.mem.read_byte(this.r_hl);
    }
    op_ld_e_a() {
      this.r_e = this.r_a;
    }
    // LD h, r
    op_ld_h_b() {
      this.r_h = this.r_b;
    }
    op_ld_h_c() {
      this.r_h = this.r_c;
    }
    op_ld_h_d() {
      this.r_h = this.r_d;
    }
    op_ld_h_e() {
      this.r_h = this.r_e;
    }
    op_ld_h_h() {
    }
    op_ld_h_l() {
      this.r_h = this.r_l;
    }
    op_ld_h_m_hl() {
      this.r_h = this.mem.read_byte(this.r_hl);
    }
    op_ld_h_a() {
      this.r_h = this.r_a;
    }
    // LD l, r
    op_ld_l_b() {
      this.r_l = this.r_b;
    }
    op_ld_l_c() {
      this.r_l = this.r_c;
    }
    op_ld_l_d() {
      this.r_l = this.r_d;
    }
    op_ld_l_e() {
      this.r_l = this.r_e;
    }
    op_ld_l_h() {
      this.r_l = this.r_h;
    }
    op_ld_l_l() {
    }
    op_ld_l_m_hl() {
      this.r_l = this.mem.read_byte(this.r_hl);
    }
    op_ld_l_a() {
      this.r_l = this.r_a;
    }
    // LD (hl), r
    op_ld_m_hl_b() {
      this.mem.write_byte(this.r_hl, this.r_b);
    }
    op_ld_m_hl_c() {
      this.mem.write_byte(this.r_hl, this.r_c);
    }
    op_ld_m_hl_d() {
      this.mem.write_byte(this.r_hl, this.r_d);
    }
    op_ld_m_hl_e() {
      this.mem.write_byte(this.r_hl, this.r_e);
    }
    op_ld_m_hl_h() {
      this.mem.write_byte(this.r_hl, this.r_h);
    }
    op_ld_m_hl_l() {
      this.mem.write_byte(this.r_hl, this.r_l);
    }
    op_ld_m_hl_a() {
      this.mem.write_byte(this.r_hl, this.r_a);
    }
    op_ld_m_hl_n() {
      let v = this.mem.read_byte(this.r_pc);
      this.pc_inc(1);
      this.mem.write_byte(this.r_hl, v);
    }
    // LD (nn), A
    op_ld_m_nn_a() {
      let addr = this.mem.read_word(this.r_pc);
      this.pc_inc(2);
      this.mem.write_word(addr, this.r_a);
    }
    // LD A, (nn)
    op_ld_a_m_nn() {
      let addr = this.mem.read_word(this.r_pc);
      this.pc_inc(2);
      this.r_a = this.mem.read_word(addr);
    }
    // LDH
    // Stores A at $0xff00 + n
    op_ldh_m_n_a() {
      let addr = 65280 + this.mem.read_byte(this.r_pc);
      this.pc_inc(1);
      this.r_a = this.mem.read_byte(addr);
    }
    op_ldh_a_m_n() {
      let addr = 65280 + this.mem.read_byte(this.r_pc);
      this.pc_inc(1);
      this.mem.write_byte(addr, this.r_a);
    }
    // Bit shifts and rotations
    // Rotate A
    op_rlca() {
      this.r_f = 0;
      this.r_f = this.r_a & 1 << 7 ? 16 /* C */ : 0;
      this.r_a = (this.r_a << 1 | this.r_a >> 7) & 255;
      this.r_f |= this.r_a ? 0 : 128 /* Z */;
    }
    // Rotate throug carry A
    op_rla() {
      this.r_f = 0;
      let carry = this.r_f & 16 /* C */;
      this.r_f = this.r_a & 1 << 7 ? 16 /* C */ : 0;
      this.r_a = this.r_a << 1 & 255;
      this.r_a |= carry ? 1 : 0;
      this.r_f |= this.r_a ? 0 : 128 /* Z */;
    }
    // Rotate A
    op_rrca() {
      this.r_f = 0;
      this.r_f = this.r_a & 1 ? 16 /* C */ : 0;
      this.r_a = (this.r_a >> 1 | (this.r_a & 1) << 7) & 255;
      this.r_f |= this.r_a ? 0 : 128 /* Z */;
    }
    // Rotate throug carry A
    op_rra() {
      this.r_f = 0;
      let carry = this.r_f & 16 /* C */;
      this.r_f = this.r_a & 1 ? 16 /* C */ : 0;
      this.r_a = this.r_a >> 1 & 255;
      this.r_a |= carry ? 1 << 7 : 0;
      this.r_f |= this.r_a ? 0 : 128 /* Z */;
    }
    // ALU operations - inc
    op_inc_b() {
      this.r_b = this.alu_perform_inc(this.r_b);
    }
    op_inc_c() {
      this.r_c = this.alu_perform_inc(this.r_c);
    }
    op_inc_d() {
      this.r_d = this.alu_perform_inc(this.r_d);
    }
    op_inc_e() {
      this.r_e = this.alu_perform_inc(this.r_e);
    }
    op_inc_h() {
      this.r_h = this.alu_perform_inc(this.r_h);
    }
    op_inc_l() {
      this.r_l = this.alu_perform_inc(this.r_l);
    }
    op_inc_m_hl() {
      let v = this.mem.read_byte(this.r_hl);
      v = this.alu_perform_inc(v);
      this.mem.write_byte(this.r_hl, v);
    }
    op_inc_a() {
      this.r_a = this.alu_perform_inc(this.r_a);
    }
    // ALU operations - dec
    op_dec_b() {
      this.r_b = this.alu_perform_dec(this.r_b);
    }
    op_dec_c() {
      this.r_c = this.alu_perform_dec(this.r_c);
    }
    op_dec_d() {
      this.r_d = this.alu_perform_dec(this.r_d);
    }
    op_dec_e() {
      this.r_e = this.alu_perform_dec(this.r_e);
    }
    op_dec_h() {
      this.r_h = this.alu_perform_dec(this.r_h);
    }
    op_dec_l() {
      this.r_l = this.alu_perform_dec(this.r_l);
    }
    op_dec_m_hl() {
      let v = this.mem.read_byte(this.r_hl);
      v = this.alu_perform_dec(v);
      this.mem.write_byte(this.r_hl, v);
    }
    op_dec_a() {
      this.r_a = this.alu_perform_dec(this.r_a);
    }
    // ALU operations - add
    op_add_a_b() {
      this.r_a = this.alu_perform_add(this.r_a, this.r_b);
    }
    op_add_a_c() {
      this.r_a = this.alu_perform_add(this.r_a, this.r_c);
    }
    op_add_a_d() {
      this.r_a = this.alu_perform_add(this.r_a, this.r_d);
    }
    op_add_a_e() {
      this.r_a = this.alu_perform_add(this.r_a, this.r_e);
    }
    op_add_a_h() {
      this.r_a = this.alu_perform_add(this.r_a, this.r_h);
    }
    op_add_a_l() {
      this.r_a = this.alu_perform_add(this.r_a, this.r_l);
    }
    op_add_a_m_hl() {
      let addr = this.mem.read_byte(this.r_hl);
      this.r_a = this.alu_perform_add(this.r_a, addr);
    }
    op_add_a_a() {
      this.r_a = this.alu_perform_add(this.r_a, this.r_a);
    }
    op_add_a_d8() {
      let d8 = this.mem.read_byte(this.r_pc);
      this.pc_inc(1);
      this.r_a = this.alu_perform_add(this.r_a, d8);
    }
    // ALU operations - sub
    op_sub_a_b() {
      this.r_a = this.alu_perform_sub(this.r_a, -this.r_b);
    }
    op_sub_a_c() {
      this.r_a = this.alu_perform_sub(this.r_a, -this.r_c);
    }
    op_sub_a_d() {
      this.r_a = this.alu_perform_sub(this.r_a, -this.r_d);
    }
    op_sub_a_e() {
      this.r_a = this.alu_perform_sub(this.r_a, -this.r_e);
    }
    op_sub_a_h() {
      this.r_a = this.alu_perform_sub(this.r_a, -this.r_h);
    }
    op_sub_a_l() {
      this.r_a = this.alu_perform_sub(this.r_a, this.r_l);
    }
    op_sub_a_m_hl() {
      let addr = this.mem.read_byte(this.r_hl);
      this.r_a = this.alu_perform_sub(this.r_a, addr);
    }
    op_sub_a_a() {
      this.r_a = this.alu_perform_sub(this.r_a, this.r_a);
    }
    op_sub_a_d8() {
      let d8 = this.mem.read_byte(this.r_pc);
      this.pc_inc(1);
      this.r_a = this.alu_perform_sub(this.r_a, d8);
    }
    // ALU operations - add with carry
    op_adc_a_b() {
      this.r_a = this.alu_perform_add_carry(this.r_a, this.r_b);
    }
    op_adc_a_c() {
      this.r_a = this.alu_perform_add_carry(this.r_a, this.r_c);
    }
    op_adc_a_d() {
      this.r_a = this.alu_perform_add_carry(this.r_a, this.r_d);
    }
    op_adc_a_e() {
      this.r_a = this.alu_perform_add_carry(this.r_a, this.r_e);
    }
    op_adc_a_h() {
      this.r_a = this.alu_perform_add_carry(this.r_a, this.r_h);
    }
    op_adc_a_l() {
      this.r_a = this.alu_perform_add_carry(this.r_a, this.r_l);
    }
    op_adc_a_m_hl() {
      let addr = this.mem.read_byte(this.r_hl);
      this.r_a = this.alu_perform_add_carry(this.r_a, addr);
    }
    op_adc_a_a() {
      this.r_a = this.alu_perform_add_carry(this.r_a, this.r_a);
    }
    op_adc_a_d8() {
      let d8 = this.mem.read_byte(this.r_pc);
      this.pc_inc(1);
      this.r_a = this.alu_perform_add_carry(this.r_a, d8);
    }
    // ALU operations - subtract
    // ALU operations - subtract with carry
    // ALU operations - AND
    op_and_a_b() {
      this.r_a &= this.r_b;
      this.r_f = 32 /* H */;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_and_a_c() {
      this.r_a &= this.r_c;
      this.r_f = 32 /* H */;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_and_a_d() {
      this.r_a &= this.r_d;
      this.r_f = 32 /* H */;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_and_a_e() {
      this.r_a &= this.r_e;
      this.r_f = 32 /* H */;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_and_a_h() {
      this.r_a &= this.r_h;
      this.r_f = 32 /* H */;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_and_a_l() {
      this.r_a &= this.r_l;
      this.r_f = 32 /* H */;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_and_a_m_hl() {
      let v = this.mem.read_byte(this.r_hl);
      this.r_a &= v;
      this.r_f = 32 /* H */;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_and_a_d8() {
      let v = this.mem.read_byte(this.r_pc);
      this.pc_inc(1);
      this.r_a &= v;
      this.r_f = 32 /* H */;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_and_a_a() {
      this.r_a &= this.r_a;
      this.r_f = 32 /* H */;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    // ALU operations - OR
    op_or_a_b() {
      this.r_a |= this.r_b;
      this.r_f = 0;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_or_a_c() {
      this.r_a |= this.r_c;
      this.r_f = 0;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_or_a_d() {
      this.r_a |= this.r_d;
      this.r_f = 0;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_or_a_e() {
      this.r_a |= this.r_e;
      this.r_f = 0;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_or_a_h() {
      this.r_a |= this.r_h;
      this.r_f = 0;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_or_a_l() {
      this.r_a |= this.r_l;
      this.r_f = 0;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_or_a_m_hl() {
      let v = this.mem.read_byte(this.r_hl);
      this.r_a |= v;
      this.r_f = 0;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_or_a_d8() {
      let v = this.mem.read_byte(this.r_pc);
      this.pc_inc(1);
      this.r_a |= v;
      this.r_f = 0;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_or_a_a() {
      this.r_a |= this.r_a;
      this.r_f = 0;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    // ALU operations - CP
    op_cp_a_b() {
      this.alu_perform_sub(this.r_a, this.r_b);
      this.r_f = this.r_f ^ (16 /* C */ | 32 /* H */);
    }
    op_cp_a_c() {
      this.alu_perform_sub(this.r_a, this.r_c);
      this.r_f = this.r_f ^ (16 /* C */ | 32 /* H */);
    }
    op_cp_a_d() {
      this.alu_perform_sub(this.r_a, this.r_d);
      this.r_f = this.r_f ^ (16 /* C */ | 32 /* H */);
    }
    op_cp_a_e() {
      this.alu_perform_sub(this.r_a, this.r_e);
      this.r_f = this.r_f ^ (16 /* C */ | 32 /* H */);
    }
    op_cp_a_h() {
      this.alu_perform_sub(this.r_a, this.r_h);
      this.r_f = this.r_f ^ (16 /* C */ | 32 /* H */);
    }
    op_cp_a_l() {
      this.alu_perform_sub(this.r_a, this.r_l);
      this.r_f = this.r_f ^ (16 /* C */ | 32 /* H */);
    }
    op_cp_a_m_hl() {
      let v = this.mem.read_byte(this.r_hl);
      this.alu_perform_sub(this.r_a, v);
      this.r_f = this.r_f ^ (16 /* C */ | 32 /* H */);
    }
    op_cp_a_d8() {
      let n = this.mem.read_byte(this.r_pc);
      this.pc_inc(1);
      this.alu_perform_sub(this.r_a, n);
      this.r_f = this.r_f ^ (16 /* C */ | 32 /* H */);
    }
    op_cp_a_a() {
      this.r_f = 128 /* Z */ | 32 /* H */ | 16 /* C */ | 64 /* N */;
    }
    // ALU operations - XOR
    op_xor_a_b() {
      this.r_a ^= this.r_b;
      this.r_f = 0;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_xor_a_c() {
      this.r_a ^= this.r_c;
      this.r_f = 0;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_xor_a_d() {
      this.r_a ^= this.r_d;
      this.r_f = 0;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_xor_a_e() {
      this.r_a ^= this.r_e;
      this.r_f = 0;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_xor_a_h() {
      this.r_a ^= this.r_h;
      this.r_f = 0;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_xor_a_l() {
      this.r_a ^= this.r_l;
      this.r_f = 0;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_xor_a_m_hl() {
      let v = this.mem.read_byte(this.r_hl);
      this.r_a ^= v;
      this.r_f = 0;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_xor_a_d8() {
      let v = this.mem.read_byte(this.r_pc);
      this.pc_inc(1);
      this.r_a ^= v;
      this.r_f = 0;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    op_xor_a_a() {
      this.r_a ^= this.r_a;
      this.r_f = 0;
      if (this.r_a == 0) {
        this.r_f |= 128 /* Z */;
      }
    }
    // JP - jump instructions
    op_jp_nn() {
      this.r_pc = this.mem.read_word(this.r_pc);
    }
    op_jp_nz_nn() {
      if (~this.r_f & 128 /* Z */) {
        this.r_pc = this.mem.read_word(this.r_pc);
      } else {
        this.pc_inc(2);
      }
    }
    op_jp_z_nn() {
      if (this.r_f & 128 /* Z */) {
        this.r_pc = this.mem.read_word(this.r_pc);
      } else {
        this.pc_inc(2);
      }
    }
    op_jp_nc_nn() {
      if (~this.r_c & 16 /* C */) {
        this.r_pc = this.mem.read_word(this.r_pc);
      } else {
        this.pc_inc(2);
      }
    }
    op_jp_c_nn() {
      if (this.r_c & 16 /* C */) {
        this.r_pc = this.mem.read_word(this.r_pc);
      } else {
        this.pc_inc(2);
      }
    }
    op_jp_hl() {
      this.r_pc = this.r_hl;
    }
    op_jr_n() {
      let n = this.mem.read_byte(this.r_pc);
      this.r_pc = this.r_pc - 1 + (n << 24 >> 24);
    }
    op_jr_nz() {
      let n = this.mem.read_byte(this.r_pc);
      if (~this.r_f & 128 /* Z */) {
        this.r_pc = this.r_pc - 1 + (n << 24 >> 24);
      } else {
        this.pc_inc(1);
      }
    }
    op_jr_z() {
      let n = this.mem.read_byte(this.r_pc);
      if (this.r_f & 128 /* Z */) {
        this.r_pc = this.r_pc - 1 + (n << 24 >> 24);
      } else {
        this.pc_inc(1);
      }
    }
    op_jr_nc() {
      let n = this.mem.read_byte(this.r_pc);
      if (~this.r_c & 16 /* C */) {
        this.r_pc = this.r_pc - 1 + (n << 24 >> 24);
      } else {
        this.pc_inc(1);
      }
    }
    op_jr_c() {
      let n = this.mem.read_byte(this.r_pc);
      if (this.r_c & 16 /* C */) {
        this.r_pc = this.r_pc - 1 + (n << 24 >> 24);
      } else {
        this.pc_inc(1);
      }
    }
    get r_af() {
      return this.r_f << 8 | this.r_a;
    }
    set r_af(v) {
      this.r_a = v & 255;
      this.r_f = v >> 8;
    }
    get r_bc() {
      return this.r_c << 8 | this.r_b;
    }
    set r_bc(v) {
      this.r_b = v & 255;
      this.r_c = v >> 8;
    }
    get r_de() {
      return this.r_e << 8 | this.r_d;
    }
    set r_de(v) {
      this.r_d = v & 255;
      this.r_e = v >> 8;
    }
    get r_hl() {
      return this.r_l << 8 | this.r_h;
    }
    set r_hl(v) {
      this.r_h = v & 255;
      this.r_l = v >> 8;
    }
    initialize_instr() {
      this.instr.fill(this.op_stub);
      this.instr[0] = this.op_nop;
      this.instr[1] = this.op_ld_bc_nn;
      this.instr[3] = this.op_inc_bc;
      this.instr[4] = this.op_inc_b;
      this.instr[5] = this.op_dec_b;
      this.instr[6] = this.op_ld_b_n;
      this.instr[7] = this.op_rlca;
      this.instr[8] = this.op_ld_m_nn_sp;
      this.instr[9] = this.op_add_hl_bc;
      this.instr[12] = this.op_inc_c;
      this.instr[13] = this.op_dec_c;
      this.instr[14] = this.op_ld_c_n;
      this.instr[15] = this.op_rrca;
      this.instr[17] = this.op_ld_de_nn;
      this.instr[19] = this.op_inc_de;
      this.instr[20] = this.op_inc_d;
      this.instr[21] = this.op_dec_d;
      this.instr[22] = this.op_ld_d_n;
      this.instr[23] = this.op_rla;
      this.instr[24] = this.op_jr_n;
      this.instr[25] = this.op_add_hl_de;
      this.instr[28] = this.op_inc_e;
      this.instr[29] = this.op_dec_e;
      this.instr[30] = this.op_ld_e_n;
      this.instr[31] = this.op_rra;
      this.instr[32] = this.op_jr_nz;
      this.instr[33] = this.op_ld_hl_nn;
      this.instr[35] = this.op_inc_hl;
      this.instr[36] = this.op_inc_h;
      this.instr[37] = this.op_dec_h;
      this.instr[38] = this.op_ld_h_n;
      this.instr[40] = this.op_jr_z;
      this.instr[41] = this.op_add_hl_hl;
      this.instr[42] = this.op_ldi_a_m_hl;
      this.instr[44] = this.op_inc_l;
      this.instr[45] = this.op_dec_l;
      this.instr[46] = this.op_ld_l_n;
      this.instr[48] = this.op_jr_nc;
      this.instr[49] = this.op_ld_sp_nn;
      this.instr[50] = this.op_ldd_m_hl_a;
      this.instr[51] = this.op_inc_sp;
      this.instr[52] = this.op_inc_m_hl;
      this.instr[53] = this.op_dec_m_hl;
      this.instr[54] = this.op_ld_m_hl_n;
      this.instr[56] = this.op_jr_c;
      this.instr[57] = this.op_add_hl_sp;
      this.instr[60] = this.op_inc_a;
      this.instr[61] = this.op_dec_a;
      this.instr[62] = this.op_ld_a_n;
      this.instr[64] = this.op_ld_b_b;
      this.instr[65] = this.op_ld_b_c;
      this.instr[66] = this.op_ld_b_d;
      this.instr[67] = this.op_ld_b_e;
      this.instr[68] = this.op_ld_b_h;
      this.instr[69] = this.op_ld_b_l;
      this.instr[70] = this.op_ld_b_m_hl;
      this.instr[71] = this.op_ld_b_a;
      this.instr[72] = this.op_ld_c_b;
      this.instr[73] = this.op_ld_c_c;
      this.instr[74] = this.op_ld_c_d;
      this.instr[75] = this.op_ld_c_e;
      this.instr[76] = this.op_ld_c_h;
      this.instr[77] = this.op_ld_c_l;
      this.instr[78] = this.op_ld_c_m_hl;
      this.instr[79] = this.op_ld_c_a;
      this.instr[80] = this.op_ld_d_b;
      this.instr[81] = this.op_ld_d_c;
      this.instr[82] = this.op_ld_d_d;
      this.instr[83] = this.op_ld_d_e;
      this.instr[84] = this.op_ld_d_h;
      this.instr[85] = this.op_ld_d_l;
      this.instr[86] = this.op_ld_d_m_hl;
      this.instr[87] = this.op_ld_d_a;
      this.instr[88] = this.op_ld_e_b;
      this.instr[89] = this.op_ld_e_c;
      this.instr[90] = this.op_ld_e_d;
      this.instr[91] = this.op_ld_e_e;
      this.instr[92] = this.op_ld_e_h;
      this.instr[93] = this.op_ld_e_l;
      this.instr[94] = this.op_ld_e_m_hl;
      this.instr[95] = this.op_ld_e_a;
      this.instr[96] = this.op_ld_h_b;
      this.instr[97] = this.op_ld_h_c;
      this.instr[98] = this.op_ld_h_d;
      this.instr[99] = this.op_ld_h_e;
      this.instr[100] = this.op_ld_h_h;
      this.instr[101] = this.op_ld_h_l;
      this.instr[102] = this.op_ld_h_m_hl;
      this.instr[103] = this.op_ld_h_a;
      this.instr[104] = this.op_ld_l_b;
      this.instr[105] = this.op_ld_l_c;
      this.instr[106] = this.op_ld_l_d;
      this.instr[107] = this.op_ld_l_e;
      this.instr[108] = this.op_ld_l_h;
      this.instr[109] = this.op_ld_l_l;
      this.instr[110] = this.op_ld_l_m_hl;
      this.instr[111] = this.op_ld_l_a;
      this.instr[112] = this.op_ld_m_hl_b;
      this.instr[113] = this.op_ld_m_hl_c;
      this.instr[114] = this.op_ld_m_hl_d;
      this.instr[115] = this.op_ld_m_hl_e;
      this.instr[116] = this.op_ld_m_hl_h;
      this.instr[117] = this.op_ld_m_hl_l;
      this.instr[119] = this.op_ld_m_hl_a;
      this.instr[120] = this.op_ld_a_b;
      this.instr[121] = this.op_ld_a_c;
      this.instr[122] = this.op_ld_a_d;
      this.instr[123] = this.op_ld_a_e;
      this.instr[124] = this.op_ld_a_h;
      this.instr[125] = this.op_ld_a_l;
      this.instr[126] = this.op_ld_a_m_hl;
      this.instr[127] = this.op_ld_a_a;
      this.instr[128] = this.op_add_a_b;
      this.instr[129] = this.op_add_a_c;
      this.instr[130] = this.op_add_a_d;
      this.instr[131] = this.op_add_a_e;
      this.instr[132] = this.op_add_a_h;
      this.instr[133] = this.op_add_a_l;
      this.instr[134] = this.op_add_a_m_hl;
      this.instr[135] = this.op_add_a_a;
      this.instr[136] = this.op_adc_a_b;
      this.instr[137] = this.op_adc_a_c;
      this.instr[138] = this.op_adc_a_d;
      this.instr[139] = this.op_adc_a_e;
      this.instr[140] = this.op_adc_a_h;
      this.instr[141] = this.op_adc_a_l;
      this.instr[142] = this.op_adc_a_m_hl;
      this.instr[143] = this.op_adc_a_a;
      this.instr[144] = this.op_sub_a_b;
      this.instr[145] = this.op_sub_a_c;
      this.instr[146] = this.op_sub_a_d;
      this.instr[147] = this.op_sub_a_e;
      this.instr[148] = this.op_sub_a_h;
      this.instr[149] = this.op_sub_a_l;
      this.instr[150] = this.op_sub_a_m_hl;
      this.instr[151] = this.op_sub_a_a;
      this.instr[160] = this.op_and_a_b;
      this.instr[161] = this.op_and_a_c;
      this.instr[162] = this.op_and_a_d;
      this.instr[163] = this.op_and_a_e;
      this.instr[164] = this.op_and_a_h;
      this.instr[165] = this.op_and_a_l;
      this.instr[166] = this.op_and_a_m_hl;
      this.instr[167] = this.op_and_a_a;
      this.instr[168] = this.op_xor_a_b;
      this.instr[169] = this.op_xor_a_c;
      this.instr[170] = this.op_xor_a_d;
      this.instr[171] = this.op_xor_a_e;
      this.instr[172] = this.op_xor_a_h;
      this.instr[173] = this.op_xor_a_l;
      this.instr[174] = this.op_xor_a_m_hl;
      this.instr[175] = this.op_xor_a_a;
      this.instr[176] = this.op_or_a_b;
      this.instr[177] = this.op_or_a_c;
      this.instr[178] = this.op_or_a_d;
      this.instr[179] = this.op_or_a_e;
      this.instr[180] = this.op_or_a_h;
      this.instr[181] = this.op_or_a_l;
      this.instr[182] = this.op_or_a_m_hl;
      this.instr[183] = this.op_or_a_a;
      this.instr[184] = this.op_cp_a_b;
      this.instr[185] = this.op_cp_a_c;
      this.instr[186] = this.op_cp_a_d;
      this.instr[187] = this.op_cp_a_e;
      this.instr[188] = this.op_cp_a_h;
      this.instr[189] = this.op_cp_a_l;
      this.instr[190] = this.op_cp_a_m_hl;
      this.instr[191] = this.op_cp_a_a;
      this.instr[192] = this.op_ret_nz;
      this.instr[193] = this.op_pop_bc;
      this.instr[194] = this.op_jp_nz_nn;
      this.instr[195] = this.op_jp_nn;
      this.instr[196] = this.op_call_nz_nn;
      this.instr[197] = this.op_push_bc;
      this.instr[198] = this.op_add_a_d8;
      this.instr[199] = this.op_rst_00;
      this.instr[200] = this.op_ret_z;
      this.instr[201] = this.op_ret;
      this.instr[202] = this.op_jp_z_nn;
      this.instr[204] = this.op_call_z_nn;
      this.instr[205] = this.op_call_nn;
      this.instr[206] = this.op_adc_a_d8;
      this.instr[207] = this.op_rst_08;
      this.instr[208] = this.op_ret_nc;
      this.instr[209] = this.op_pop_de;
      this.instr[210] = this.op_jp_nc_nn;
      this.instr[212] = this.op_call_nc_nn;
      this.instr[213] = this.op_push_de;
      this.instr[215] = this.op_rst_10;
      this.instr[216] = this.op_ret_c;
      this.instr[217] = this.op_reti;
      this.instr[218] = this.op_jp_c_nn;
      this.instr[220] = this.op_call_c_nn;
      this.instr[223] = this.op_rst_18;
      this.instr[224] = this.op_ldh_m_n_a;
      this.instr[229] = this.op_push_hl;
      this.instr[230] = this.op_and_a_d8;
      this.instr[231] = this.op_rst_20;
      this.instr[234] = this.op_ld_m_nn_a;
      this.instr[238] = this.op_xor_a_d8;
      this.instr[239] = this.op_rst_28;
      this.instr[240] = this.op_ldh_a_m_n;
      this.instr[245] = this.op_push_af;
      this.instr[246] = this.op_or_a_d8;
      this.instr[247] = this.op_rst_30;
      this.instr[249] = this.op_ld_sp_hl;
      this.instr[250] = this.op_ld_a_m_nn;
      this.instr[254] = this.op_cp_a_d8;
      this.instr[255] = this.op_rst_38;
    }
  };

  // src/cartridge.ts
  var CART_OFFSET_TITLE = 308;
  var CART_TITLE_END = 322;
  var CART_OFFSET_TYPE = 327;
  var CART_OFFSET_ROM_SIZE = 328;
  var CART_OFFSET_RAM_SIZE = 329;
  var Cartridge = class {
    constructor(data) {
      this.data = data;
      let titleData = data.slice(CART_OFFSET_TITLE, CART_TITLE_END);
      this.title = new TextDecoder("ascii").decode(titleData);
      this.type = data[CART_OFFSET_TYPE];
      this.romSize = data[CART_OFFSET_ROM_SIZE];
      this.ramSize = data[CART_OFFSET_RAM_SIZE];
    }
    load(mem2) {
      mem2.rom_bank0 = this.data.slice(0, 16384);
    }
  };

  // src/main.ts
  var mem = new Memory();
  var display = new Display(mem);
  var cpu = new CPU(mem);
  async function load_rom() {
    let romData = await fetch("./tetris.gb").then((res) => res.arrayBuffer());
    return new Uint8Array(romData);
  }
  async function start() {
    let cartData = await load_rom();
    let cart = new Cartridge(cartData);
    cart.load(mem);
    run();
  }
  function run() {
    for (let i = 0; i < 500; i++) {
      cpu.run();
    }
    cpu.send_interrupt(64 /* VBlank */);
    for (let i = 0; i < 500; i++) {
      cpu.run();
    }
    display.draw_frame();
    setTimeout(run, 20);
  }
  start();
})();
