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

    op_ld_a_hl() {

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
    private r_pc: number;

    private get af() {
        return (this.r_a << 16) | this.r_b;
    }

    private set af(v: number) {
        this.r_a = v >> 8;
        this.r_f = v & 0xff;
    }

    private get bc() {
        return (this.r_b << 16) | this.r_c;
    }

    private set bc(v: number) {
        this.r_b = v >> 8;
        this.r_c = v & 0xff;
    }

    private get de() {
        return (this.r_d << 16) | this.r_e;
    }

    private set de(v: number) {
        this.r_d = v >> 8;
        this.r_e = v & 0xff;
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
