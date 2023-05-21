import { Memory } from "./memory";

// Zero flag is set when the result of a math operation is zero
// OR two valeus match after CP instruction

// Subtract flag is set if a subtraction was done

// Half carry is set when a carry occurred in the lower nibble of the last math op

// Carry flag is set when a carry occurred

enum FlagsRegister {
    Z = (1 << 7), // Zero flag
    N = (1 << 6), // Subtract flag
    H = (1 << 5), // Half carry flag
    C = (1 << 4) // Carry flag
};

export enum IRQ {
    VBlank = 0x40,
    LCDCStatus = 0x48,
    TimerOverflow = 0x50,
    SerialTransfer = 0x58,
    Joypad = 0x60
};

enum IRQBit {
    VBlank = 1,
    LCDCStatus = 2,
    TimerOverflow = 4,
    SerialTransfer = 8,
    Joypad = 0x10,
};

export class CPU {
    constructor(mem: Memory) {
        this.mem = mem;
        mem.cpu = this;

        this.initialize_instr();

        this.initialize();
    }

    initialize() {
        this.r_pc = 0x100;
        this.r_a = 1;
        this.r_b = 0;
        this.r_c = 0x13;
        this.r_d = 0;
        this.r_e = 0xd8;
        this.r_h = 0x1;
        this.r_l = 0x4d;

        this.r_sp = 0xfffe;
        this.r_f = FlagsRegister.Z;

        this.r_ime = 0;
        this.pending_ints = 0;
    }

    run() {
        let interrupts = (this.mem.int_flag & this.mem.int_en);
        if (this.r_ime && interrupts) {
            if (interrupts & IRQBit.VBlank) {
                this.mem.int_flag &= ~(IRQBit.VBlank);
                console.log("handling vblank! IF:" + this.mem.int_flag.toString(16));
                this.handle_interrupt(IRQ.VBlank);
            } else if (interrupts & IRQBit.LCDCStatus) {
                this.mem.int_flag &= ~(IRQBit.LCDCStatus);
                this.handle_interrupt(IRQ.LCDCStatus);
            } else if (interrupts & IRQBit.TimerOverflow) {
                this.mem.int_flag &= ~(IRQBit.TimerOverflow);
                this.handle_interrupt(IRQ.TimerOverflow);
            } else if (interrupts & IRQBit.SerialTransfer) {
                this.mem.int_flag &= ~(IRQBit.SerialTransfer);
                this.handle_interrupt(IRQ.SerialTransfer);
            } else if (interrupts & IRQBit.Joypad) {
                this.mem.int_flag &= ~(IRQBit.Joypad);
                this.handle_interrupt(IRQ.Joypad);
            }
        }

        let opcode = this.mem.read_byte(this.r_pc);

        //console.log(`pc: ${ this.r_pc.toString(16) }, op: ${ opcode.toString(16) }`);
        //console.log(`a: ${ this.r_a.toString(16) }, b: ${ this.r_b.toString(16) }, \
//c: ${this.r_c.toString(16)}, d: ${this.r_d.toString(16)}, e: ${this.r_e.toString(16)}, \
//h: ${this.r_h.toString(16)}, l: ${this.r_l.toString(16)}`);

        this.pc_inc(1);

        let op = this.instr[opcode];
        if(op == this.op_stub) {
            throw new Error(`Unimplemented opcode: ${opcode}`)
        }

        // EI and DI enable/disable interrupts after the NEXT instruction,
        // check if we need to en/disable ints after this instruction
        if(this.pending_int_enable != this.r_ime) {
            op.call(this);
            this.r_ime = this.pending_int_enable;
        } else {
            op.call(this);
        }
    }

    handle_interrupt(irq: number) {
        // Save the PC on the stack
        this.sp_inc(-2);
        this.mem.write_word(this.r_sp, this.r_pc);

        this.r_pc = irq;
        this.r_ime = 0;
    }

    send_interrupt(irq: number) {
        switch(irq) {
        case IRQ.VBlank:
            this.mem.int_flag |= IRQBit.VBlank;
            break;
        case IRQ.LCDCStatus:
            this.mem.int_flag |= IRQBit.LCDCStatus;
            break;
        case IRQ.SerialTransfer:
            this.mem.int_flag |= IRQBit.SerialTransfer;
            break;
        case IRQ.TimerOverflow:
            this.mem.int_flag |= IRQBit.TimerOverflow;
            break;
        case IRQ.Joypad:
            this.mem.int_flag |= IRQBit.Joypad;
            break;
        default:
            throw new Error("Unknown interrupt!");
        }
    }

    pc_inc(n: number) {
        this.r_pc = (this.r_pc + n) & 0xffff;
    }

    sp_inc(n: number) {
        this.r_sp = (this.r_sp + n) & 0xffff;
    }

    alu_perform_add(l: number, r: number): number {
        let low = (l & 0xf) + (r & 0xf);

        this.r_f = 0;
        if (low & 0x10) {
            this.r_f |= FlagsRegister.H;
        }

        let high = ((l >> 8) & 0xf) + ((r >> 8) & 0xf);
        if (high & 0x10) {
            this.r_f |= FlagsRegister.C;
        }

        let result = (low + high) & 0xff;
        if(result == 0) {
            this.r_f |= FlagsRegister.Z;
        }

        return result;
    }

    alu_perform_sub(l: number, r: number): number {
        let low = (l & 0xf) - (r & 0xf);

        this.r_f = 0;
        if (low < 0) {
            this.r_f |= FlagsRegister.H;
        }

        if (l - r < 0) {
            this.r_f |= FlagsRegister.C;
        }

        let result = (l - r) & 0xff;
        if(result == 0) {
            this.r_f |= FlagsRegister.Z;
        }

        return result;
    }

    alu_perform_inc(v: number): number {
        let low = (v & 0xf) + 1;

        // Carry isn't affected!
        this.r_f = (this.r_f & FlagsRegister.C);
        if (low & 0x10) {
            this.r_f |= FlagsRegister.H;
        }

        let result = (v + 1) & 0xff;
        if(result == 0) {
            this.r_f |= FlagsRegister.Z;
        }

        return result;
    }

    alu_perform_dec(v: number): number {
        let low = (v & 0xf) - 1;

        // Carry isn't affected!
        this.r_f = (this.r_f & FlagsRegister.C) | FlagsRegister.N;
        if (low < 0) {
            this.r_f |= FlagsRegister.H;
        }

        let result = (v - 1) & 0xff;
        if(result == 0) {
            this.r_f |= FlagsRegister.Z;
        }

        return result;
    }

    alu_perform_add_carry(l: number, r: number): number {
        let low = (l & 0xf) + (r & 0xf);
        if (this.r_f & FlagsRegister.C) {
            low += 1;
        }

        this.r_f = 0;
        if (low & 0x10) {
            this.r_f |= FlagsRegister.H;
        }

        let high = ((l >> 8) & 0xf) + ((r >> 8) & 0xf);
        if (high & 0x10) {
            this.r_f |= FlagsRegister.C;
        }

        let result = (low + high) & 0xff;
        if(result == 0) {
            this.r_f |= FlagsRegister.Z;
        }

        return result;
    }

    alu_perform_sub_carry(l: number, r: number): number {
        let low = (l & 0xf) - (r & 0xf);
        
        let c = this.r_f & FlagsRegister.C;
        if (c) {
            low -= 1;
        }

        this.r_f = 0;
        if (low < 0) {
            this.r_f |= FlagsRegister.H;
        }

        let high = ((l >> 8) & 0xf) - ((r >> 8) & 0xf);
        if (high < 0) {
            this.r_f |= FlagsRegister.C;
        }

        let result = (l - r - (c ? 1 : 0)) & 0xff;
        if(result == 0) {
            this.r_f |= FlagsRegister.Z;
        }

        return result;
    }

    op_stub() {
        throw new Error();
    }

    cb_stub(v: number): number {
        throw new Error();
    }

    op_nop() {

    }

    op_di() {
        this.pending_int_enable = 0;
    }

    op_ei() {
        this.pending_int_enable = 1;
    }

    op_rst_00() {
        this.sp_inc(-2);
        this.mem.write_word(this.r_sp, this.r_pc);

        this.r_pc = 0;
    }

    op_rst_08() {
        this.sp_inc(-2);
        this.mem.write_word(this.r_sp, this.r_pc);

        this.r_pc = 0x8;
    }

    op_rst_10() {
        this.sp_inc(-2);
        this.mem.write_word(this.r_sp, this.r_pc);

        this.r_pc = 0x10;
    }

    op_rst_18() {
        this.sp_inc(-2);
        this.mem.write_word(this.r_sp, this.r_pc);

        this.r_pc = 0x18;
    }

    op_rst_20() {
        this.sp_inc(-2);
        this.mem.write_word(this.r_sp, this.r_pc);

        this.r_pc = 0x20;
    }

    op_rst_28() {
        this.sp_inc(-2);
        this.mem.write_word(this.r_sp, this.r_pc);

        this.r_pc = 0x28;
    }

    op_rst_30() {
        this.sp_inc(-2);
        this.mem.write_word(this.r_sp, this.r_pc);

        this.r_pc = 0x30;
    }

    op_rst_38() {
        this.sp_inc(-2);
        this.mem.write_word(this.r_sp, this.r_pc);

        this.r_pc = 0x38;
    }

    // DAA - Decimal adjust A
    // Weird instruction - modfiies the last addition or subtraction to treat the number as a 
    // BCD number. 
    op_daa() {
        // To be a valid BCD, each nibble must be within the range of 0-9.
        // If it is greater than 9, add 6 to carry to the next nibble
        if(this.r_f & FlagsRegister.N) {
            // Nibbles >= 0xa only occur when there was a borrow
            if(this.r_f & FlagsRegister.C) {
                this.r_a -= 0x60;
            }

            if(this.r_f & FlagsRegister.H) {
                this.r_a -= 0x6;
            }
        } else {
            // We check for 0x99 as if A is say 0x9a, then after the lower nibble is adjusted,
            // the upper nibble will be in the 0xa-0xf range (not a valid BCD)
            if((this.r_f & FlagsRegister.C) || this.r_a >= 0x99) {
                this.r_a += 0x60;

                // Set carry if not already set
                this.r_f |= FlagsRegister.C;
            }

            if(this.r_f & FlagsRegister.H || (this.r_a & 0xf) >= 0xa) {
                this.r_a += 0x6;
            }
        }

        // Only preserve the carry and subtract flag
        this.r_f = this.r_f & (FlagsRegister.C | FlagsRegister.N);
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    // SCF - set carry flag
    op_scf() {
        // Only preserve the zero flag
        this.r_f = (this.r_f & FlagsRegister.Z) | FlagsRegister.C;
    }

    op_cpl() {
        this.r_a = ~this.r_a;
    }

    // Complement carry flag
    op_ccf() {
        this.r_f = (this.r_f & FlagsRegister.Z) | ((~this.r_f) & FlagsRegister.C);
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

        this.r_hl = (this.r_sp + (n << 24 >> 24)) & 0xffff;

        // We need to set the C and H flags
        this.alu_perform_add(this.r_sp & 0xff, n);
        this.r_f &= (FlagsRegister.C | FlagsRegister.H);
    }

    op_ld_m_bc_a() {
        this.mem.write_byte(this.r_bc, this.r_a);
    }
    
    op_ld_m_de_a() {
        this.mem.write_byte(this.r_de, this.r_a);
    }

    op_ld_a_m_bc() {
        this.r_a = this.mem.read_byte(this.r_bc);
    }
    
    op_ld_a_m_de() {
        this.r_a = this.mem.read_byte(this.r_de);
    }

    op_ldd_m_hl_a() {
        // Store A at (HL) and decrement HL
        this.op_ld_m_hl_a()
        this.r_hl = (this.r_hl - 1) & 0xffff;
    }

    op_ldi_m_hl_a() {
        // Store A at (HL) and increment HL
        this.op_ld_m_hl_a()
        this.r_hl = (this.r_hl + 1) & 0xffff;
    }

    op_ldd_a_m_hl() {
        // Store (HL) in A and decrement HL
        this.op_ld_a_m_hl()
        this.r_hl = (this.r_hl - 1) & 0xffff;
    }

    op_ldi_a_m_hl() {
        // Store (HL) in A and increment HL
        this.op_ld_a_m_hl()
        this.r_hl = (this.r_hl + 1) & 0xffff;
    }

    // Save SP at immediate address
    op_ld_m_nn_sp() {
        let addr = this.mem.read_word(this.r_pc);
        this.pc_inc(2);

        this.mem.write_word(addr, this.r_sp);
    }

    // 16-bit arithmetic
    op_inc_bc() {
        this.r_bc = (this.r_bc + 1) & 0xffff;
    }

    op_inc_de() {
        this.r_de = (this.r_de + 1) & 0xffff;
    }

    op_inc_hl() {
        this.r_hl = (this.r_hl + 1) & 0xffff;
    }

    op_inc_sp() {
        this.r_sp = (this.r_sp + 1) & 0xffff;
    }

    op_dec_bc() {
        this.r_bc = (this.r_bc - 1) & 0xffff;
    }

    op_dec_de() {
        this.r_de = (this.r_de - 1) & 0xffff;
    }

    op_dec_hl() {
        this.r_hl = (this.r_hl - 1) & 0xffff;
    }

    op_dec_sp() {
        this.r_sp = (this.r_sp - 1) & 0xffff;
    }

    op_add_hl_bc() {
        let fl = (this.r_f & FlagsRegister.Z);

        // Check for carry from bits 11 and 15
        this.alu_perform_add(this.r_h, this.r_b);

        this.r_hl = (this.r_hl + this.r_bc) & 0xffff;

        this.r_f = fl | (this.r_f & (FlagsRegister.C | FlagsRegister.H));
    }

    op_add_hl_de() {
        let fl = (this.r_f & FlagsRegister.Z);

        // Check for carry from bits 11 and 15
        this.alu_perform_add(this.r_h, this.r_d);

        this.r_hl = (this.r_hl + this.r_de) & 0xffff;

        this.r_f = fl | (this.r_f & (FlagsRegister.C | FlagsRegister.H));
    }

    op_add_hl_hl() {
        let fl = (this.r_f & FlagsRegister.Z);

        // Check for carry from bits 11 and 15
        this.alu_perform_add(this.r_h, this.r_h);

        this.r_hl = (this.r_hl + this.r_hl) & 0xffff;

        this.r_f = fl | (this.r_f & (FlagsRegister.C | FlagsRegister.H));
    }

    op_add_hl_sp() {
        let fl = (this.r_f & FlagsRegister.Z);

        // Check for carry from bits 11 and 15
        this.alu_perform_add(this.r_h, (this.r_sp >> 8));

        this.r_hl = (this.r_hl + this.r_sp) & 0xffff;

        this.r_f = fl | (this.r_f & (FlagsRegister.C | FlagsRegister.H));
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
        this.pc_inc(2)
        
        if((~this.r_f) & FlagsRegister.Z) {
            this.sp_inc(-2)
            this.mem.write_word(this.r_sp, this.r_pc);

            this.r_pc = addr;
        }
    }

    op_call_z_nn() {
        let addr = this.mem.read_word(this.r_pc);
        this.pc_inc(2)
        
        if(this.r_f & FlagsRegister.Z) {
            this.sp_inc(-2)
            this.mem.write_word(this.r_sp, this.r_pc);

            this.r_pc = addr;
        }
    }

    op_call_nc_nn() {
        let addr = this.mem.read_word(this.r_pc);
        this.pc_inc(2)
        
        if((~this.r_f) & FlagsRegister.C) {
            this.sp_inc(-2)
            this.mem.write_word(this.r_sp, this.r_pc);

            this.r_pc = addr;
        }
    }

    op_call_c_nn() {
        let addr = this.mem.read_word(this.r_pc);
        this.pc_inc(2)
        
        if(this.r_f & FlagsRegister.C) {
            this.sp_inc(-2)
            this.mem.write_word(this.r_sp, this.r_pc);

            this.r_pc = addr;
        }
    }

    op_ret() {
        this.r_pc = this.mem.read_word(this.r_sp);
        this.sp_inc(2);
    }

    op_reti() {
        // Jump then enable interrupts
        this.r_pc = this.mem.read_word(this.r_sp);
        this.sp_inc(2);

        this.r_ime = 1;
    }

    op_ret_nz() {
        if((~this.r_f) & FlagsRegister.Z) {
            this.r_pc = this.mem.read_word(this.r_sp);
            this.sp_inc(2);
        }
    }

    op_ret_z() {
        if(this.r_f & FlagsRegister.Z) {
            this.r_pc = this.mem.read_word(this.r_sp);
            this.sp_inc(2);
        }
    }

    op_ret_nc() {
        if((~this.r_f) & FlagsRegister.C) {
            this.r_pc = this.mem.read_word(this.r_sp);
            this.sp_inc(2);
        }
    }

    op_ret_c() {
        if(this.r_f & FlagsRegister.C) {
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
        let addr = 0xff00 + this.mem.read_byte(this.r_pc);
        this.pc_inc(1);

        this.mem.write_byte(addr, this.r_a); 
    }

    op_ldh_a_m_n() {
        let addr = 0xff00 + this.mem.read_byte(this.r_pc);
        this.pc_inc(1);

        this.r_a = this.mem.read_byte(addr);
    }

    op_ld_m_c_a() {
        let addr = 0xff00 + this.r_c;

        this.mem.write_byte(addr, this.r_a); 
    }

    op_ld_a_m_c() {
        let addr = 0xff00 + this.r_c;

        this.r_a = this.mem.read_byte(addr); 
    }

    // Bit shifts and rotations

    // Rotate A
    op_rlca() {
        this.r_a = this.op_cb_rlc(this.r_a);
    }

    // Rotate throug carry A
    op_rla() {
        this.r_a = this.op_cb_rl(this.r_a);
    }

    // Rotate A
    op_rrca() {
        this.r_f = 0;

        // The old value of bit 0 goes into the carry
        this.r_f = (this.r_a & 1) ? FlagsRegister.C : 0;

        // Old LSB of A moves to the MSB
        this.r_a = ((this.r_a >> 1) | ((this.r_a & 1) << 7)) & 0xff;

        this.r_f |= this.r_a ? 0 : FlagsRegister.Z;
    }

    // Rotate throug carry A
    op_rra() {
        this.r_f = 0;

        let carry = this.r_f & FlagsRegister.C;

        // The old value of bit 0 goes into the carry
        this.r_f = (this.r_a & 1) ? FlagsRegister.C : 0;

        this.r_a = (this.r_a >> 1) & 0xff;
        // Old value of the carry goes into A
        this.r_a |= carry ? (1 << 7) : 0;

        this.r_f |= this.r_a ? 0 : FlagsRegister.Z;
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
        let v = this.mem.read_byte(this.r_hl)
        
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
        let v = this.mem.read_byte(this.r_hl)
        
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
        this.r_a = this.alu_perform_sub(this.r_a, this.r_b);
    }

    op_sub_a_c() {
        this.r_a = this.alu_perform_sub(this.r_a, this.r_c);
    }

    op_sub_a_d() {
        this.r_a = this.alu_perform_sub(this.r_a, this.r_d);
    }

    op_sub_a_e() {
        this.r_a = this.alu_perform_sub(this.r_a, this.r_e);
    }

    op_sub_a_h() {
        this.r_a = this.alu_perform_sub(this.r_a, this.r_h);
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

    // ALU operations - subtract with carry
    op_sbc_a_b() {
        this.r_a = this.alu_perform_sub_carry(this.r_a, this.r_b);
    }

    op_sbc_a_c() {
        this.r_a = this.alu_perform_sub_carry(this.r_a, this.r_c);
    }

    op_sbc_a_d() {
        this.r_a = this.alu_perform_sub_carry(this.r_a, this.r_d);
    }

    op_sbc_a_e() {
        this.r_a = this.alu_perform_sub_carry(this.r_a, this.r_e);
    }

    op_sbc_a_h() {
        this.r_a = this.alu_perform_sub_carry(this.r_a, this.r_h);
    }

    op_sbc_a_l() {
        this.r_a = this.alu_perform_sub_carry(this.r_a, this.r_l);
    }

    op_sbc_a_m_hl() {
        let addr = this.mem.read_byte(this.r_hl);

        this.r_a = this.alu_perform_sub_carry(this.r_a, addr);
    }

    op_sbc_a_a() {
        this.r_a = this.alu_perform_sub_carry(this.r_a, this.r_a);
    }

    op_sbc_a_d8() {
        let d8 = this.mem.read_byte(this.r_pc);
        this.pc_inc(1);

        this.r_a = this.alu_perform_add_carry(this.r_a, d8);
    }

    // ALU operations - AND
    op_and_a_b() {
        this.r_a &= this.r_b;

        this.r_f = FlagsRegister.H;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_and_a_c() {
        this.r_a &= this.r_c;

        this.r_f = FlagsRegister.H;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_and_a_d() {
        this.r_a &= this.r_d;

        this.r_f = FlagsRegister.H;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_and_a_e() {
        this.r_a &= this.r_e;

        this.r_f = FlagsRegister.H;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_and_a_h() {
        this.r_a &= this.r_h;

        this.r_f = FlagsRegister.H;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_and_a_l() {
        this.r_a &= this.r_l;

        this.r_f = FlagsRegister.H;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_and_a_m_hl() {
        let v = this.mem.read_byte(this.r_hl);

        this.r_a &= v;

        this.r_f = FlagsRegister.H;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_and_a_d8() {
        let v = this.mem.read_byte(this.r_pc);
        this.pc_inc(1);

        this.r_a &= v;

        this.r_f = FlagsRegister.H;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_and_a_a() {
        this.r_a &= this.r_a;

        this.r_f = FlagsRegister.H;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    // ALU operations - OR
    op_or_a_b() {
        this.r_a |= this.r_b;

        this.r_f = 0;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_or_a_c() {
        this.r_a |= this.r_c;

        this.r_f = 0;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_or_a_d() {
        this.r_a |= this.r_d;

        this.r_f = 0;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_or_a_e() {
        this.r_a |= this.r_e;

        this.r_f = 0;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_or_a_h() {
        this.r_a |= this.r_h;

        this.r_f = 0;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_or_a_l() {
        this.r_a |= this.r_l;

        this.r_f = 0;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_or_a_m_hl() {
        let v = this.mem.read_byte(this.r_hl);

        this.r_a |= v;

        this.r_f = 0;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_or_a_d8() {
        let v = this.mem.read_byte(this.r_pc);
        this.pc_inc(1);

        this.r_a |= v;

        this.r_f = 0;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_or_a_a() {
        this.r_a |= this.r_a;

        this.r_f = 0;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    // ALU operations - CP
    op_cp_a_b() {
        this.alu_perform_sub(this.r_a, this.r_b);
    }

    op_cp_a_c() {
        this.alu_perform_sub(this.r_a, this.r_c);
    }

    op_cp_a_d() {
        this.alu_perform_sub(this.r_a, this.r_d);
    }

    op_cp_a_e() {
        this.alu_perform_sub(this.r_a, this.r_e);
    }

    op_cp_a_h() {
        this.alu_perform_sub(this.r_a, this.r_h);
    }

    op_cp_a_l() {
        this.alu_perform_sub(this.r_a, this.r_l);
    }

    op_cp_a_m_hl() {
        let v = this.mem.read_byte(this.r_hl);

        this.alu_perform_sub(this.r_a, v);
    }

    op_cp_a_d8() {
        let n = this.mem.read_byte(this.r_pc);
        this.pc_inc(1);

        this.alu_perform_sub(this.r_a, n);
    }

    op_cp_a_a() {
        this.alu_perform_sub(this.r_a, this.r_a);
    }

    // ALU operations - XOR
    op_xor_a_b() {
        this.r_a ^= this.r_b;

        this.r_f = 0;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_xor_a_c() {
        this.r_a ^= this.r_c;

        this.r_f = 0;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_xor_a_d() {
        this.r_a ^= this.r_d;

        this.r_f = 0;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_xor_a_e() {
        this.r_a ^= this.r_e;

        this.r_f = 0;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_xor_a_h() {
        this.r_a ^= this.r_h;

        this.r_f = 0;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_xor_a_l() {
        this.r_a ^= this.r_l;

        this.r_f = 0;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_xor_a_m_hl() {
        let v = this.mem.read_byte(this.r_hl);

        this.r_a ^= v;

        this.r_f = 0;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_xor_a_d8() {
        let v = this.mem.read_byte(this.r_pc);
        this.pc_inc(1);

        this.r_a ^= v;

        this.r_f = 0;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_xor_a_a() {
        this.r_a ^= this.r_a;

        this.r_f = 0;
        if(this.r_a == 0) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    // JP - jump instructions
    op_jp_nn() {
        this.r_pc = this.mem.read_word(this.r_pc);
    }

    op_jp_nz_nn() {
        if((~this.r_f) & FlagsRegister.Z) {
            this.r_pc = this.mem.read_word(this.r_pc);
        } else {
            this.pc_inc(2);
        }
    }

    op_jp_z_nn() {
        if(this.r_f & FlagsRegister.Z) {
            this.r_pc = this.mem.read_word(this.r_pc);
        } else {
            this.pc_inc(2);
        }
    }

    op_jp_nc_nn() {
        if((~this.r_c) & FlagsRegister.C) {
            this.r_pc = this.mem.read_word(this.r_pc);
        } else {
            this.pc_inc(2);
        }
    }

    op_jp_c_nn() {
        if(this.r_c & FlagsRegister.C) {
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
        this.pc_inc(1);

        // Do some javascript fuckery to make n signed,
        // bitwise operations are 32-bit so force a sign extension
        this.r_pc = this.r_pc + (n << 24 >> 24);
    }

    op_jr_nz() {
        let n = this.mem.read_byte(this.r_pc);
        this.pc_inc(1);

        if((~this.r_f) & FlagsRegister.Z) {
            this.r_pc = this.r_pc + (n << 24 >> 24);
        }
    }

    op_jr_z() {
        let n = this.mem.read_byte(this.r_pc);
        this.pc_inc(1);

        if(this.r_f & FlagsRegister.Z) {
            this.r_pc = this.r_pc + (n << 24 >> 24);
        }
    }

    op_jr_nc() {
        let n = this.mem.read_byte(this.r_pc);
        this.pc_inc(1);

        if((~this.r_f) & FlagsRegister.C) {
            this.r_pc = this.r_pc + (n << 24 >> 24);
        }
    }

    op_jr_c() {
        let n = this.mem.read_byte(this.r_pc);
        this.pc_inc(1);

        if(this.r_f & FlagsRegister.C) {
            this.r_pc = this.r_pc + (n << 24 >> 24);
        }
    }

    // Rotate 
    op_cb_rlc(v: number): number {
        this.r_f = 0;

        // The old value of bit 7 goes into the carry
        this.r_f = (v & (1 << 7)) ? FlagsRegister.C : 0;

        // Old MSB of A moves to the LSB
        v = ((v << 1) | (v >> 7)) & 0xff;

        this.r_f |= v ? 0 : FlagsRegister.Z;
        return v;
    }

    // Rotate through carry
    op_cb_rl(v: number): number {
        this.r_f = 0;

        let carry = this.r_f & FlagsRegister.C;

        // The old value of bit 7 goes into the carry
        this.r_f = (v & (1 << 7)) ? FlagsRegister.C : 0;

        v = (v << 1) & 0xff;
        // Old value of the carry goes into A
        v |= carry ? 1 : 0;

        this.r_f |= v ? 0 : FlagsRegister.Z;
        return v;
    }

    // Shift left into carry
    op_cb_sla(v: number): number {
        // The old value of bit 7 goes into the carry
        this.r_f = (v & (1 << 7)) ? FlagsRegister.C : 0;
        v = (v << 1) & 0xff;

        this.r_f |= v ? 0 : FlagsRegister.Z;
        return v;
    }

    // Swap upper and lower nibbles
    op_cb_swap(v: number): number {
        if (v == 0) {
            this.r_f = FlagsRegister.Z;
        } else {
            v = ((v & 0xf) << 4) | (v >> 4);
            this.r_f = 0;    
        }

        return v;
    }

    op_cb_res0(v: number): number {
        return v & ~(1 << 0);
    }

    op_cb_res1(v: number): number {
        return v & ~(1 << 1);
    }

    op_cb_res2(v: number): number {
        return v & ~(1 << 2);
    }

    op_cb_res3(v: number): number {
        return v & ~(1 << 3);
    }

    op_cb_res4(v: number): number {
        return v & ~(1 << 4);
    }

    op_cb_res5(v: number): number {
        return v & ~(1 << 5);
    }

    op_cb_res6(v: number): number {
        return v & ~(1 << 6);
    }

    op_cb_res7(v: number): number {
        return v & ~(1 << 7);
    }

    op_cb_set0(v: number): number {
        return v | (1 << 0);
    }

    op_cb_set1(v: number): number {
        return v | (1 << 1);
    }

    op_cb_set2(v: number): number {
        return v | (1 << 2);
    }

    op_cb_set3(v: number): number {
        return v | (1 << 3);
    }

    op_cb_set4(v: number): number {
        return v | (1 << 4);
    }

    op_cb_set5(v: number): number {
        return v | (1 << 5);
    }

    op_cb_set6(v: number): number {
        return v | (1 << 6);
    }

    op_cb_set7(v: number): number {
        return v | (1 << 7);
    }

    op_cb_bit(v: number, b: number): void {
        this.r_f = FlagsRegister.H;
        if((~this.r_f) & (1 << b)) {
            this.r_f |= FlagsRegister.Z;
        }
    }

    op_cb() {
        let opcode = this.mem.read_byte(this.r_pc);
        this.pc_inc(1);

        if((opcode & 0xf0) >= 0x40 && (opcode & 0xf0) <= 0x70) {
            // Ok a bit going on here, opcodes 0x4x-0x7x are bit test instructions,
            // to test bit 0 the instruction is 0x4x, where x is 0-7
            // to test bit 1 the insturction is 0x4x, where x is from 8-15
            // 2 and 3 are 0x5x, and so on
            let bit = (opcode >> 4) & 0x3 + ((opcode >> 3) & 1);
            
            switch(opcode & 0x7) {
            case 0x0:
                this.op_cb_bit(this.r_b, bit);
                break;
            case 0x1:
                this.op_cb_bit(this.r_c, bit);
                break;
            case 0x2:
                this.op_cb_bit(this.r_d, bit);
                break;
            case 0x3:
                this.op_cb_bit(this.r_e, bit);
                break;
            case 0x4:
                this.op_cb_bit(this.r_h, bit);
                break;
            case 0x5:
                this.op_cb_bit(this.r_l, bit);
                break;
            case 0x6:
                let v = this.mem.read_byte(this.r_hl);
                this.op_cb_bit(v, bit);
                break;
            case 0x7:
                this.op_cb_bit(this.r_a, bit);
                break;
            }
        } else {
            let op = this.cb_instr[opcode >> 4 | ((opcode & 0x8) << 1)];
            if(op == this.cb_stub) {
                throw new Error(`Unimplemented CB prefix opcode: ${opcode}`)
            }

            switch(opcode & 0x7) {
            case 0x0:
                this.r_b = op.call(this, this.r_b);
                break;
            case 0x1:
                this.r_c = op.call(this, this.r_c);
                break;
            case 0x2:
                this.r_d = op.call(this, this.r_d);
                break;
            case 0x3:
                this.r_e = op.call(this, this.r_e);
                break;
            case 0x4:
                this.r_h = op.call(this, this.r_h);
                break;
            case 0x5:
                this.r_l = op.call(this, this.r_l);
                break;
            case 0x6:
                let v = this.mem.read_byte(this.r_hl);
                this.mem.write_byte(this.r_hl, op.call(this, v));
                break;
            case 0x7:
                this.r_a = op.call(this, this.r_a);
                break;
            }
        }
    }

    private mem: Memory;

    // Interrupt master enable
    private r_ime: number;

    public r_a: number;
    public r_f: number;

    public r_b: number;
    public r_c: number;
    
    public r_d: number;
    public r_e: number;

    public r_h: number;
    public r_l: number;

    public r_sp: number;
    public r_pc: number;

    private pending_ints: number = 0;
    private pending_int_enable: number = 0;

    // Apparently the registers are given in big-endian order wtf
    private get r_af() {
        return (this.r_a << 8) | this.r_f;
    }

    private set r_af(v: number) {
        this.r_f = v & 0xff;
        this.r_a = v >> 8;
    }

    private get r_bc() {
        return (this.r_b << 8) | this.r_c;
    }

    private set r_bc(v: number) {
        this.r_c = v & 0xff;
        this.r_b = v >> 8;
    }

    private get r_de() {
        return (this.r_d << 8) | this.r_e;
    }

    private set r_de(v: number) {
        this.r_e = v & 0xff;
        this.r_d = v >> 8;
    }

    private get r_hl() {
        return (this.r_h << 8) | this.r_l;
    }

    private set r_hl(v: number) {
        this.r_l = v & 0xff;
        this.r_h = v >> 8;
    }

    private instr: { (): void; } [] = new Array(0x100);
    private cb_instr: { (v: number): number; } [] = new Array(0x20);

    initialize_instr() {
        this.instr.fill(this.op_stub);
        this.cb_instr.fill(this.cb_stub);

        this.instr[0] = this.op_nop;

        this.instr[0x01] = this.op_ld_bc_nn;
        this.instr[0x02] = this.op_ld_m_bc_a;
        this.instr[0x03] = this.op_inc_bc;
        this.instr[0x04] = this.op_inc_b;
        this.instr[0x05] = this.op_dec_b;
        this.instr[0x06] = this.op_ld_b_n;
        this.instr[0x07] = this.op_rlca;
        this.instr[0x08] = this.op_ld_m_nn_sp;
        this.instr[0x09] = this.op_add_hl_bc;
        this.instr[0x0a] = this.op_ld_a_m_bc;
        this.instr[0x0b] = this.op_dec_bc;
        this.instr[0x0c] = this.op_inc_c;
        this.instr[0x0d] = this.op_dec_c;
        this.instr[0x0e] = this.op_ld_c_n;
        this.instr[0x0f] = this.op_rrca;

        this.instr[0x11] = this.op_ld_de_nn;
        this.instr[0x12] = this.op_ld_m_de_a;
        this.instr[0x13] = this.op_inc_de;
        this.instr[0x14] = this.op_inc_d;
        this.instr[0x15] = this.op_dec_d;
        this.instr[0x16] = this.op_ld_d_n;
        this.instr[0x17] = this.op_rla;
        this.instr[0x18] = this.op_jr_n;
        this.instr[0x19] = this.op_add_hl_de;
        this.instr[0x1a] = this.op_ld_a_m_de;
        this.instr[0x1b] = this.op_dec_de;
        this.instr[0x1c] = this.op_inc_e;
        this.instr[0x1d] = this.op_dec_e;
        this.instr[0x1e] = this.op_ld_e_n;
        this.instr[0x1f] = this.op_rra;

        this.instr[0x20] = this.op_jr_nz;
        this.instr[0x21] = this.op_ld_hl_nn;
        this.instr[0x22] = this.op_ldi_m_hl_a;
        this.instr[0x23] = this.op_inc_hl;
        this.instr[0x24] = this.op_inc_h;
        this.instr[0x25] = this.op_dec_h;
        this.instr[0x26] = this.op_ld_h_n;
        this.instr[0x27] = this.op_daa;
        this.instr[0x28] = this.op_jr_z;
        this.instr[0x29] = this.op_add_hl_hl;
        this.instr[0x2a] = this.op_ldi_a_m_hl;
        this.instr[0x2b] = this.op_dec_hl;
        this.instr[0x2c] = this.op_inc_l;
        this.instr[0x2d] = this.op_dec_l;
        this.instr[0x2e] = this.op_ld_l_n;
        this.instr[0x2f] = this.op_cpl;

        this.instr[0x30] = this.op_jr_nc;
        this.instr[0x31] = this.op_ld_sp_nn;
        this.instr[0x32] = this.op_ldd_m_hl_a;
        this.instr[0x33] = this.op_inc_sp;
        this.instr[0x34] = this.op_inc_m_hl;
        this.instr[0x35] = this.op_dec_m_hl;
        this.instr[0x36] = this.op_ld_m_hl_n;
        this.instr[0x37] = this.op_scf;
        this.instr[0x38] = this.op_jr_c;
        this.instr[0x39] = this.op_add_hl_sp;
        this.instr[0x3a] = this.op_ldd_a_m_hl;
        this.instr[0x3b] = this.op_dec_sp;
        this.instr[0x3c] = this.op_inc_a;
        this.instr[0x3d] = this.op_dec_a;
        this.instr[0x3e] = this.op_ld_a_n;
        this.instr[0x3f] = this.op_ccf;

        this.instr[0x40] = this.op_ld_b_b;
        this.instr[0x41] = this.op_ld_b_c;
        this.instr[0x42] = this.op_ld_b_d;
        this.instr[0x43] = this.op_ld_b_e;
        this.instr[0x44] = this.op_ld_b_h;
        this.instr[0x45] = this.op_ld_b_l;
        this.instr[0x46] = this.op_ld_b_m_hl;
        this.instr[0x47] = this.op_ld_b_a;

        this.instr[0x48] = this.op_ld_c_b;
        this.instr[0x49] = this.op_ld_c_c;
        this.instr[0x4a] = this.op_ld_c_d;
        this.instr[0x4b] = this.op_ld_c_e;
        this.instr[0x4c] = this.op_ld_c_h;
        this.instr[0x4d] = this.op_ld_c_l;
        this.instr[0x4e] = this.op_ld_c_m_hl;
        this.instr[0x4f] = this.op_ld_c_a;

        this.instr[0x50] = this.op_ld_d_b;
        this.instr[0x51] = this.op_ld_d_c;
        this.instr[0x52] = this.op_ld_d_d;
        this.instr[0x53] = this.op_ld_d_e;
        this.instr[0x54] = this.op_ld_d_h;
        this.instr[0x55] = this.op_ld_d_l;
        this.instr[0x56] = this.op_ld_d_m_hl;
        this.instr[0x57] = this.op_ld_d_a;

        this.instr[0x58] = this.op_ld_e_b;
        this.instr[0x59] = this.op_ld_e_c;
        this.instr[0x5a] = this.op_ld_e_d;
        this.instr[0x5b] = this.op_ld_e_e;
        this.instr[0x5c] = this.op_ld_e_h;
        this.instr[0x5d] = this.op_ld_e_l;
        this.instr[0x5e] = this.op_ld_e_m_hl;
        this.instr[0x5f] = this.op_ld_e_a;

        this.instr[0x60] = this.op_ld_h_b;
        this.instr[0x61] = this.op_ld_h_c;
        this.instr[0x62] = this.op_ld_h_d;
        this.instr[0x63] = this.op_ld_h_e;
        this.instr[0x64] = this.op_ld_h_h;
        this.instr[0x65] = this.op_ld_h_l;
        this.instr[0x66] = this.op_ld_h_m_hl;
        this.instr[0x67] = this.op_ld_h_a;

        this.instr[0x68] = this.op_ld_l_b;
        this.instr[0x69] = this.op_ld_l_c;
        this.instr[0x6a] = this.op_ld_l_d;
        this.instr[0x6b] = this.op_ld_l_e;
        this.instr[0x6c] = this.op_ld_l_h;
        this.instr[0x6d] = this.op_ld_l_l;
        this.instr[0x6e] = this.op_ld_l_m_hl;
        this.instr[0x6f] = this.op_ld_l_a;

        this.instr[0x70] = this.op_ld_m_hl_b;
        this.instr[0x71] = this.op_ld_m_hl_c;
        this.instr[0x72] = this.op_ld_m_hl_d;
        this.instr[0x73] = this.op_ld_m_hl_e;
        this.instr[0x74] = this.op_ld_m_hl_h;
        this.instr[0x75] = this.op_ld_m_hl_l;
        //this.instr[0x76] = this.op_halt;
        this.instr[0x77] = this.op_ld_m_hl_a;

        this.instr[0x78] = this.op_ld_a_b;
        this.instr[0x79] = this.op_ld_a_c;
        this.instr[0x7a] = this.op_ld_a_d;
        this.instr[0x7b] = this.op_ld_a_e;
        this.instr[0x7c] = this.op_ld_a_h;
        this.instr[0x7d] = this.op_ld_a_l;
        this.instr[0x7e] = this.op_ld_a_m_hl;
        this.instr[0x7f] = this.op_ld_a_a;

        this.instr[0x80] = this.op_add_a_b;
        this.instr[0x81] = this.op_add_a_c;
        this.instr[0x82] = this.op_add_a_d;
        this.instr[0x83] = this.op_add_a_e;
        this.instr[0x84] = this.op_add_a_h;
        this.instr[0x85] = this.op_add_a_l;
        this.instr[0x86] = this.op_add_a_m_hl;
        this.instr[0x87] = this.op_add_a_a;

        this.instr[0x88] = this.op_adc_a_b;
        this.instr[0x89] = this.op_adc_a_c;
        this.instr[0x8a] = this.op_adc_a_d;
        this.instr[0x8b] = this.op_adc_a_e;
        this.instr[0x8c] = this.op_adc_a_h;
        this.instr[0x8d] = this.op_adc_a_l;
        this.instr[0x8e] = this.op_adc_a_m_hl;
        this.instr[0x8f] = this.op_adc_a_a;

        this.instr[0x90] = this.op_sub_a_b;
        this.instr[0x91] = this.op_sub_a_c;
        this.instr[0x92] = this.op_sub_a_d;
        this.instr[0x93] = this.op_sub_a_e;
        this.instr[0x94] = this.op_sub_a_h;
        this.instr[0x95] = this.op_sub_a_l;
        this.instr[0x96] = this.op_sub_a_m_hl;
        this.instr[0x97] = this.op_sub_a_a;

        this.instr[0x98] = this.op_sbc_a_b;
        this.instr[0x99] = this.op_sbc_a_c;
        this.instr[0x9a] = this.op_sbc_a_d;
        this.instr[0x9b] = this.op_sbc_a_e;
        this.instr[0x9c] = this.op_sbc_a_h;
        this.instr[0x9d] = this.op_sbc_a_l;
        this.instr[0x9e] = this.op_sbc_a_m_hl;
        this.instr[0x9f] = this.op_sbc_a_a;

        this.instr[0xa0] = this.op_and_a_b;
        this.instr[0xa1] = this.op_and_a_c;
        this.instr[0xa2] = this.op_and_a_d;
        this.instr[0xa3] = this.op_and_a_e;
        this.instr[0xa4] = this.op_and_a_h;
        this.instr[0xa5] = this.op_and_a_l;
        this.instr[0xa6] = this.op_and_a_m_hl;
        this.instr[0xa7] = this.op_and_a_a;

        this.instr[0xa8] = this.op_xor_a_b;
        this.instr[0xa9] = this.op_xor_a_c;
        this.instr[0xaa] = this.op_xor_a_d;
        this.instr[0xab] = this.op_xor_a_e;
        this.instr[0xac] = this.op_xor_a_h;
        this.instr[0xad] = this.op_xor_a_l;
        this.instr[0xae] = this.op_xor_a_m_hl;
        this.instr[0xaf] = this.op_xor_a_a;

        this.instr[0xb0] = this.op_or_a_b;
        this.instr[0xb1] = this.op_or_a_c;
        this.instr[0xb2] = this.op_or_a_d;
        this.instr[0xb3] = this.op_or_a_e;
        this.instr[0xb4] = this.op_or_a_h;
        this.instr[0xb5] = this.op_or_a_l;
        this.instr[0xb6] = this.op_or_a_m_hl;
        this.instr[0xb7] = this.op_or_a_a;

        this.instr[0xb8] = this.op_cp_a_b;
        this.instr[0xb9] = this.op_cp_a_c;
        this.instr[0xba] = this.op_cp_a_d;
        this.instr[0xbb] = this.op_cp_a_e;
        this.instr[0xbc] = this.op_cp_a_h;
        this.instr[0xbd] = this.op_cp_a_l;
        this.instr[0xbe] = this.op_cp_a_m_hl;
        this.instr[0xbf] = this.op_cp_a_a;

        this.instr[0xc0] = this.op_ret_nz;
        this.instr[0xc1] = this.op_pop_bc;
        this.instr[0xc2] = this.op_jp_nz_nn;
        this.instr[0xc3] = this.op_jp_nn;
        this.instr[0xc4] = this.op_call_nz_nn;
        this.instr[0xc5] = this.op_push_bc;
        this.instr[0xc6] = this.op_add_a_d8;
        this.instr[0xc7] = this.op_rst_00;
        this.instr[0xc8] = this.op_ret_z;
        this.instr[0xc9] = this.op_ret;
        this.instr[0xca] = this.op_jp_z_nn;
        this.instr[0xcb] = this.op_cb;
        this.instr[0xcc] = this.op_call_z_nn;
        this.instr[0xcd] = this.op_call_nn;
        this.instr[0xce] = this.op_adc_a_d8;
        this.instr[0xcf] = this.op_rst_08;

        this.instr[0xd0] = this.op_ret_nc;
        this.instr[0xd1] = this.op_pop_de;
        this.instr[0xd2] = this.op_jp_nc_nn;
        this.instr[0xd4] = this.op_call_nc_nn;
        this.instr[0xd5] = this.op_push_de;
        this.instr[0xd7] = this.op_rst_10;
        this.instr[0xd8] = this.op_ret_c;
        this.instr[0xd9] = this.op_reti;
        this.instr[0xda] = this.op_jp_c_nn;
        this.instr[0xdc] = this.op_call_c_nn;
        this.instr[0xdf] = this.op_rst_18;

        this.instr[0xe0] = this.op_ldh_m_n_a;
        this.instr[0xe1] = this.op_pop_hl;
        this.instr[0xe2] = this.op_ld_m_c_a;
        this.instr[0xe5] = this.op_push_hl;
        this.instr[0xe6] = this.op_and_a_d8;
        this.instr[0xe7] = this.op_rst_20;
        this.instr[0xe9] = this.op_jp_hl;
        this.instr[0xea] = this.op_ld_m_nn_a;
        this.instr[0xee] = this.op_xor_a_d8;
        this.instr[0xef] = this.op_rst_28;

        this.instr[0xf0] = this.op_ldh_a_m_n;
        this.instr[0xf1] = this.op_pop_af;
        this.instr[0xf2] = this.op_ld_a_m_c;
        this.instr[0xf3] = this.op_di;
        this.instr[0xf5] = this.op_push_af;
        this.instr[0xf6] = this.op_or_a_d8;
        this.instr[0xf7] = this.op_rst_30;
        this.instr[0xf9] = this.op_ld_sp_hl;
        this.instr[0xfa] = this.op_ld_a_m_nn;
        this.instr[0xfb] = this.op_ei;
        this.instr[0xfe] = this.op_cp_a_d8;
        this.instr[0xff] = this.op_rst_38;
    
        this.cb_instr[0] = this.op_cb_rlc;
        this.cb_instr[0x1] = this.op_cb_rl;
        this.cb_instr[0x2] = this.op_cb_sla;
        this.cb_instr[0x3] = this.op_cb_swap;
        this.cb_instr[0x8] = this.op_cb_res0;
        this.cb_instr[0x9] = this.op_cb_res2;
        this.cb_instr[0xa] = this.op_cb_res4;
        this.cb_instr[0xb] = this.op_cb_res6;
        this.cb_instr[0xc] = this.op_cb_set0;
        this.cb_instr[0xd] = this.op_cb_set2;
        this.cb_instr[0xe] = this.op_cb_set4;
        this.cb_instr[0xf] = this.op_cb_set6;

        this.cb_instr[0x18] = this.op_cb_res1;
        this.cb_instr[0x19] = this.op_cb_res3;
        this.cb_instr[0x1a] = this.op_cb_res5;
        this.cb_instr[0x1b] = this.op_cb_res7;
        this.cb_instr[0x1c] = this.op_cb_set1;
        this.cb_instr[0x1d] = this.op_cb_set3;
        this.cb_instr[0x1e] = this.op_cb_set5;
        this.cb_instr[0x1f] = this.op_cb_set7;
    }
};
