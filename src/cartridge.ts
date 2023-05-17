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

class Cartridge {
    public data: Uint8Array;
};
