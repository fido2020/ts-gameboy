export enum SpriteFlags {
    // If set, the sprite is hidden behind
    // colors 1, 2, 3 of the bg and windows
    Priority = (1 << 7),
    // Pattern is flipped vertically
    YFlip = (1 << 6),
    // Pattern is flipped horizontally
    XFlip = (1 << 5),
    // Sprite colors are taken from OBJ1PAL
    // if this flag is 1, OBJ0PAL otherwise
    PaletteNum = (1 << 4),
};

export type Sprite = {
    x: number,
    y: number,
    patternNum: number,
    flags: number
};

export const GB_VBLANK_START_LINE = 144;

export enum LCDC {
    LCDEnable = (1 << 7),
    WindowTilemapArea = (1 << 6),
    WindowEnable = (1 << 5),
    BGWindowDataArea = (1 << 4),
    BGTilemapArea = (1 << 3),
    OBJSize = (1 << 2),
    OBJEnable = (1 << 1),
    BGWindowEnable = 1,
};
