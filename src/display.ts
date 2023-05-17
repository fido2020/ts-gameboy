import { Memory } from "./memory";

export class Display {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private mem: Memory;

    constructor(mem: Memory) {
        this.mem = mem;

        this.canvas = document.getElementById("display") as HTMLCanvasElement;
        this.ctx = this.canvas.getContext("2d");

        this.ctx.fillRect(0, 0, 100, 100);
    }

    draw_frame() {
        for(let i = 0; i < 100; i++) {
            this.draw_scanline(i);
        }
    }

    draw_scanline(index: number) {
        let firstTile = (index / 8) * 32;
        for(let i = 0; i < 32; i++) {
            let tileIndex = firstTile + i;
            let tile = this.mem.read_byte(memory.GB_BG_TILEMAP + tileIndex);

            // Each tile pattern takes up 16 bytes
            let pattern1 = this.mem.read_byte(memory.GB_SPRITE_PATTERN_TABLE + tileIndex * 16 + (index % 8) * 2);
            let pattern2 = this.mem.read_byte(memory.GB_SPRITE_PATTERN_TABLE + tileIndex * 16  + (index % 8) * 2 + 1);
        
            for(let p = 0; p < 4; p++) {
                this.ctx.fillStyle = "#000000";
                if (pattern1 & (1 << p)) {
                    this.ctx.fillStyle = "#FFFFFF";
                }
                this.ctx.fillRect(i * 8 + p, index, 1, 1);

                this.ctx.fillStyle = "#000000";
                if (pattern2 & (1 << p)) {
                    this.ctx.fillStyle = "#FFFFFF";
                }
                this.ctx.fillRect(i * 8 + 4 + p, index, 1, 1);
            }
        }
    }
};
