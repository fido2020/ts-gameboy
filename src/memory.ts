import { Sprite } from "./video";

export const GB_INTERNAL_MEM_SZ: number = 8 * 0x1000;
export const GB_COLOR_INTERNAL_MEM_SZ: number = 32 * 0x1000;

export const GB_INTERNAL_VMEM_SZ: number = 8 * 0x1000;
export const GB_COLOR_INTERNAL_VMEM_SZ: number = 16 * 0x1000;

export const GB_ROM_BANK_SZ: number = 4 * 0x1000

export const GB_SPRITE_PATTERN_TABLE = 0x8000;
export const GB_WINDOW_PATTERN_TABLE = 0x8800;
export const GB_SPRITE_ATTRIBUTE_TABLE = 0xFE00;
export const GB_BG_TILEMAP = 0x9800;
export const GB_WINDOW_TILEMAP = 0x9C00;

export const GB_SPRITE_COUNT = 40;

enum IOPort {
    P1 = 0xFF00, // P1 - joypad info and system type
    SB = 0xFF01, // Serial transfer data
    SC = 0xFF02, // Serial IO control
    DIV = 0xFF04, // Timer divider
    TIMA = 0xFF05, // Timer counter
    TMA = 0xFF06, // Timer modulo
    TAC = 0xFF07, // Timer control
    IF = 0xFF0F, // Interrupt flag
    // Sound registers
    NR10 = 0xFF10,
    NR11 = 0xFF11,
    NR12 = 0xFF12,
    NR13 = 0xFF13,
    NR14 = 0xFF14,
    NR21 = 0xFF16,
    NR22 = 0xFF17,
    NR23 = 0xFF18,
    NR24 = 0xFF19,
    NR30 = 0xFF1A,
    NR31 = 0xFF1B,
    NR32 = 0xFF1C,
    NR33 = 0xFF1D,
    NR34 = 0xFF1E,
    NR41 = 0xFF20,
    NR42 = 0xFF21,
    NR43 = 0xFF22,
    NR44 = 0xFF23,
    NR50 = 0xFF24,
    NR51 = 0xFF25,
    NR52 = 0xFF26,
    // Video registers
    LCDC = 0xFF40,
    STAT = 0xFF41, // LCD status
    SCY = 0xFF42, // Viewport Y
    SCX = 0xFF43, // X
    LY = 0xFF44,
    LYC = 0xFF45,

    // Interrupt enable
    IE = 0xFFFF,
}

export class Memory {
    constructor() {
        this.rom_bank0 = new Uint8Array(GB_ROM_BANK_SZ);

        this.internal_mem = new Uint8Array(GB_INTERNAL_MEM_SZ);
        this.video_mem = new Uint8Array(GB_INTERNAL_VMEM_SZ);
        this.high_mem = new Uint8Array(0xFFFF - 0xFF80);

        this.sprite_mem = new Array<Sprite>(GB_SPRITE_COUNT);
        this.sprite_mem.fill({ x: 0, y: 0, patternNum: 0, flags: 0 });
    }

    write_byte(address: number, value: number) {
        if (address < 0x4000) {9
            // Discard writes to ROM
        } else if (address < 0x8000) {
            // TODO: switchable rom behaviour
        } else if (address < 0xA000) {
            console.log("writing to: " + address.toString(16))
            this.video_mem[address - 0x8000] = value;
        } else if (address < 0xC000) {
            // TODO: switchable ram behaviour
        } else if (address < 0xE000) {
            this.internal_mem[address - 0xC000] = value;
        } else if (address < 0xFE00) {
            this.internal_mem[address - 0xE000] = value;
        } else if (address < 0xFEA0) {
            // Sprite attribute memory
            let index = (address & 0xff) >>> 2;
            let field = address & 0x3;

            console.log("writing to OAM at: " + address.toString(16) + ", index: " + index.toString());
            switch(field) {
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
        } else if (0xFF00 <= address && address < 0xFF4C) {
            switch(address) {
            case IOPort.P1:
            case IOPort.SB:
            case IOPort.SC:
            case IOPort.DIV:
            case IOPort.TIMA:
            case IOPort.TAC:
            case IOPort.IF:
            default:
                console.log("warning: I/O port unimplemented: " + address.toString(16));
                break;
            }
        } else if (address >= 0xFF80 && address < 0xFFFF) {
            this.high_mem[address - 0xFF80] = value;
        } else if(address == IOPort.IE) {
            console.log("Write to IME: " + value.toString(16));
        }
    }

    read_byte(address: number): number {
        if (address < 0x4000) {
            return this.rom_bank0[address];
        } else if (address < 0x8000) {
            // TODO: switchable rom behaviour
            return 0xff;
        } else if (address < 0xA000) {
            return this.video_mem[address - 0x8000];
        } else if (address < 0xC000) {
            // TODO: switchable ram behaviour
            return 0xff;
        } else if (address < 0xE000) {
            return this.internal_mem[address - 0xC000];
        } else if (address < 0xFE00) {
            return this.internal_mem[address - 0xE000];
        } else if (address < 0xFEA0) {
            // Sprite attribute memory
            let index = (address >> 2) & 0x3f;
            let field = address & 0x3;
            switch(field) {
                case 0:
                    return this.sprite_mem[index].x;
                case 1:
                    return this.sprite_mem[index].y;
                case 2:
                    return this.sprite_mem[index].patternNum;
                case 3:
                    return this.sprite_mem[index].flags;
            }
        } else if (0xFF00 <= address && address < 0xFF4C) {
            switch(address) {
            case IOPort.IF:
                console.log(`IF: ${ this.int_flag.toString(16) }`);
                return this.int_flag;
            case IOPort.LY:
                console.log(`LY: ${ this.lcd_y }`);
                return this.lcd_y;
            case IOPort.STAT:
                console.log(`STAT: ${ this.lcd_status.toString(16) }`);
                return this.lcd_status;
            case IOPort.P1:
            case IOPort.SB:
            case IOPort.SC:
            case IOPort.DIV:
            case IOPort.TIMA:
            case IOPort.TAC:
            default:
                console.log("warning: I/O port unimplemented: " + address.toString(16) + ", attempted to write: " + value.toString(16));
                return 0xFF;
            }
        } else if (address >= 0xFF80 && address < 0xFFFF) {
            return this.high_mem[address - 0xFF80];
        } else if (address == 0xFFFF) {
            return this.int_en;
        } else {
            throw new Error("Unknown address: " + address.toString(16));
        }
    }

    write_word(address: number, value: number) {
        this.write_byte(address, value & 0xff);
        this.write_byte(address + 1, value >> 8);
    }

    read_word(address: number) {
        return this.read_byte(address) | (this.read_byte(address + 1) << 8);
    }

    // 0x0000-0x4000 ROM bank 0
    public rom_bank0: Uint8Array;
    // 0x4000-0x8000 Switchable ROM
    public rom_switchable: Uint8Array;

    // 0xC000-0xE000 Internal memory
    // 0xE000-0xFE00 Echo of internal memory
    // 0xFF80-0xFFFF
    public internal_mem: Uint8Array;
    // 0x8000-0xA000 Video memory
    public video_mem: Uint8Array;

    // 0xFF80-0xFFFF High memory
    public high_mem: Uint8Array;

    public sprite_mem: Sprite[];

    // 0xFF04 timer divider
    public timer_div: number = 0;

    // 0xFF05 timer counter
    public timer_counter: number = 0;

    // 0xFF06 timer modulo
    public timer_mod: number = 0;

    // FF07
    public timer_ctl: number = 0;

    // 0xFF0F interrupt flag
    public int_flag: number = 0;
    // 0xFFFF interrupt enable
    public int_en: number = 0;

    // LCD Y (current scanline being drawn) - RO
    public lcd_y: number = 0;
    // LCD Y compare (if LYC = LY, a bit is set in the stat register)
    public lyc: number = 0;

    public lcd_status: number = 0;
};
