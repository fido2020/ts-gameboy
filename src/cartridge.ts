enum SystemType {
    Gameboy = 0,
    GameboyColor = 0x80
}

enum CartridgeType {
    ROMOnly = 0,
    ROM_MBC1 = 1,
    ROM_MBC1_RAM = 2,
    ROM_MBC1_RAM_BATT = 3
};

enum ROMSize {
    Size32K = 0,
    Size64K = 1,
    Size1M = 2,
    Size2M = 3,
    Size4M = 4,
    Size8M = 5,
    Size16M = 6,
    Size9M = 0x52,
    Size10M = 0x53,
    Size12M = 0x54,
};

enum RAMSize {
    None = 0,
    Size2K = 1,
    Size8K = 2,
    Size32K = 3,
    Size1M = 4,
};

enum DestinationCode {
    Japanese,
    Other,
};

const CART_OFFSET_TITLE = 0x134;
const CART_TITLE_END = 0x142;
const CART_OFFSET_SYSTEM_TYPE = 0x143;
const CART_OFFSET_SUPER_GB = 0x146;
const CART_OFFSET_TYPE = 0x147;
const CART_OFFSET_ROM_SIZE = 0x148;
const CART_OFFSET_RAM_SIZE = 0x149;

export class Cartridge {
    constructor(data: Uint8Array) {
        this.data = data;

        let titleData = data.slice(CART_OFFSET_TITLE, CART_TITLE_END);
        this.title = new TextDecoder("ascii").decode(titleData);

        this.type = data[CART_OFFSET_TYPE]
        this.romSize = data[CART_OFFSET_ROM_SIZE]
        this.ramSize = data[CART_OFFSET_RAM_SIZE]
    }

    public data: Uint8Array;
    public title: string;

    public type: CartridgeType;
    public romSize: ROMSize;
    public ramSize: RAMSize;
};
