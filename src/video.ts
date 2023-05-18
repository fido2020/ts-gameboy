enum SpriteFlags {
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
