const GAMEBOY_INTERNAL_MEM_SZ: number = 8 * 0x1000;
const GAMEBOY_COLOR_INTERNAL_MEM_SZ: number = 32 * 0x1000;

const GAMEBOY_INTERNAL_VMEM_SZ: number = 8 * 0x1000;
const GAMEBOY_COLOR_INTERNAL_VMEM_SZ: number = 16 * 0x1000;

const GAMEBOY_ROM_BANK_SZ: number = 4 * 0x1000

export class Memory {
    constructor() {
        this.rom_bank0 = new Uint8Array(GAMEBOY_ROM_BANK_SZ);

        this.internal_mem = new Uint8Array(GAMEBOY_INTERNAL_MEM_SZ);
        this.video_mem = new Uint8Array(GAMEBOY_INTERNAL_VMEM_SZ);
    }

    write_byte(address: number, value: number) {
        if (address < 0x4000) {
            // Discard writes to ROM
        } else if (address < 0x8000) {
            // TODO: switchable rom behaviour
        } else if (address < 0xA000) {
            this.video_mem[address - 0x8000] = value;
        } else if (address < 0xC000) {
            // TODO: switchable ram behaviour
        } else if (address < 0xE000) {
            this.internal_mem[address - 0xC000] = value;
        } else if (address < 0xFE00) {
            this.internal_mem[address - 0xE000] = value;
        } else if (address < 0xFEA0) {
            // TODO: sprite attrib memory
        } else if (0xFF00 <= address && address < 0xFF4C) {
            // TODO: I/O ports
        } else if (address >= 0xFF80 && address < 0xFFFF) {
            // TODO: Apparently more internal ram here???
        } else if(address == 0xFFFF) {
            this.int_enable = value;
        }
    }

    read_byte(address: number) {
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
            // TODO: sprite attrib memory
            return 0xFF;
        } else if (0xFF00 <= address && address < 0xFF4C) {
            // TODO: I/O ports
            return 0xFF;
        } else if (address >= 0xFF80 && address < 0xFFFF) {
            // TODO: Apparently more internal ram here???
            return 0xFF;
        } else {
            return 0xFF;
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
    public rom_bank0: Uint8Array
    // 0x4000-0x8000 Switchable ROM
    public rom_switchable: Uint8Array

    // 0xC000-0xE000 Internal memory
    // 0xE000-0xFE00 Echo of internal memory
    // 0xFF80-0xFFFF
    public internal_mem: Uint8Array
    // 0x8000-0xA000 Video memory
    public video_mem: Uint8Array

    // 0xFFFF Interrupt enable flag
    public int_enable: number
};
