import { Memory } from "./memory";

// Zero flag is set when the result of a math operation is zero
// OR two valeus match after CP instruction

// Subtract flag is set if a subtraction was done

// Half carry is set when a carry occurred in the lower nibble of the last math op

// Carry flag is set when a carry occurred

enum CPUFlags {
    Z = (1 << 7), // Zero flag
    N = (1 << 6), // Subtract flag
    H = (1 << 5), // Half carry flag
    C = (1 << 4) // Carry flag
};

export class CPU {
    constructor() {
        this.mem = new Memory;
        this.initialize_instr();

        this.initialize();
    }

    initialize() {
        this.r_pc = 0x100;
    }

    run() {
        let opcode = this.mem.read_byte(this.r_pc)
        this.r_pc += 1;

        this.instr[opcode]();
    }

    op_nop() {

    }

    op_ld_b_n() {

    }

    op_ld_c_n() {
        
    }

    op_ld_d_n() {
        
    }

    op_ld_e_n() {
        
    }

    op_ld_h_n() {
        
    }

    op_ld_l_n() {
        
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

    private mem: Memory;

    private r_a: number;
    private r_f: number;

    private r_b: number;
    private r_c: number;
    
    private r_d: number;
    private r_e: number;

    private r_h: number;
    private r_l: number;

    private r_sp: number;
    public r_pc: number;

    private get r_af() {
        return (this.r_f << 8) | this.r_a;
    }

    private set r_af(v: number) {
        this.r_a = v & 0xff;
        this.r_f = v >> 8;
    }

    private get r_bc() {
        return (this.r_c << 8) | this.r_b;
    }

    private set r_bc(v: number) {
        this.r_b = v & 0xff;
        this.r_c = v >> 8;
    }

    private get r_de() {
        return (this.r_e << 8) | this.r_d;
    }

    private set r_de(v: number) {
        this.r_d = v & 0xff;
        this.r_e = v >> 8;
    }

    private get r_hl() {
        return (this.r_l << 8) | this.r_h;
    }

    private set r_hl(v: number) {
        this.r_h = v & 0xff;
        this.r_l = v >> 8;
    }

    private instr: { (): void; } [] = new Array(0xff);

    initialize_instr() {
        this.instr.fill(this.op_nop)

        this.instr[0x06] = this.op_ld_b_n;
        this.instr[0x0e] = this.op_ld_c_n;
        this.instr[0x16] = this.op_ld_d_n;
        this.instr[0x1e] = this.op_ld_e_n;
        this.instr[0x26] = this.op_ld_h_n;
        this.instr[0x2e] = this.op_ld_l_n;
    }
};
