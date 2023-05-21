import { Memory } from "./memory";
import * as memory from "./memory";
import * as video from "./video";

export class Display {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private mem: Memory;
    public last_scanline: number = 0;
    private spritesToDraw = Array<video.Sprite>(10);

    constructor(mem: Memory) {
        this.mem = mem;

        this.canvas = document.getElementById("display") as HTMLCanvasElement;
        let ctx = this.canvas.getContext("2d");
        if (ctx == null) {
            throw new Error("Failed to get canvas rendering context!");
        }

        this.ctx = ctx;
        this.last_scanline = 0;
    }

    scanline_draw_tile(address: number, line: number, tile: number, xOffset: number) {
        // Each tile pattern takes up 16 bytes
        let pattern1 = this.mem.read_byte(address + tile * 16 + (line % 8) * 2);
        let pattern2 = this.mem.read_byte(address + tile * 16 + (line % 8) * 2 + 1);
    
        for(let p = 0; p < 8; p += 2) {
            if(pattern1 != 0 || pattern2 != 0) {
                console.log(`p1 ${pattern1.toString(16)} p2 ${pattern2.toString(16)}`);
            }

            this.ctx.fillStyle = "#FFEEDD";
            if (pattern1 & (3 << p)) {
                this.ctx.fillStyle = "#000000";
            }
            this.ctx.fillRect(xOffset + (p >> 1), line, 1, 1);

            this.ctx.fillStyle = "#FFEEDD";
            if (pattern2 & (3 << p)) {
                this.ctx.fillStyle = "#000000";
            }
            this.ctx.fillRect(xOffset + 4 + (p >> 1), line, 1, 1);
        }
    }

    draw_scanline() {
        let line = this.last_scanline;

        this.mem.lcd_y = line;

        // The vertical sprite size changes based on the LCDC register
        let spriteSize = 8;
        if (this.mem.lcd_control & video.LCDC.OBJSize) {
            spriteSize = 16;
        }

        if(line < 144) {
            let firstTile = (line >> 3) * 32;
            for(let i = 0; i < 32; i++) {
                let tileIndex = firstTile + i;
                let tile = this.mem.read_byte(memory.GB_BG_TILEMAP + tileIndex);
                this.scanline_draw_tile(memory.GB_SPRITE_PATTERN_TABLE, line, tile, i * 8);
            }

            let numSprites = 0;
            for(let i = 0; i < memory.GB_SPRITE_COUNT && numSprites < 10; i++) {
                let s = this.mem.sprite_mem[i];
                if(s.y <= line && s.y + spriteSize > line) {
                    this.spritesToDraw[numSprites++] = s;
                    console.log(`Found sprite at X: ${s.x}, Y: ${s.y}, pattern: ${s.patternNum}!`);
                }
            }

            for(let i = 0; i < numSprites; i++) {
                let s = this.spritesToDraw[i];
                let tile = s.patternNum;

                this.scanline_draw_tile(memory.GB_SPRITE_PATTERN_TABLE, line, tile, s.x);
            }
        }

        // Lines from 144-153 represnt the VBLANK interval
        this.last_scanline = (line + 1) % 154;
    }
};
