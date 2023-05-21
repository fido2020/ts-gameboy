import { Display } from "./display";
import { CPU, IRQ } from "./cpu";
import { Memory } from "./memory";
import { Cartridge } from "./cartridge"
import * as video from "./video"

let mem = new Memory;
let display = new Display(mem);
let cpu = new CPU(mem);

let cpuDump = document.getElementById("cpudump");

async function load_rom(): Promise<Uint8Array> {
    let romData: ArrayBuffer = await fetch("./tetris.gb")
        .then(res => res.arrayBuffer());
    
    return new Uint8Array(romData);
}

async function start() {
    let cartData = await load_rom();
 
    let cart = new Cartridge(cartData);
    cart.load(mem);

    run();
}

function run() {
    for(let i = 0; i < 1000; i++) {
        cpuDump.innerHTML = `pc: ${ cpu.r_pc.toString(16) }, op: ${ mem.read_byte(cpu.r_pc).toString(16) }
a: ${ cpu.r_a.toString(16) }, b: ${ cpu.r_b.toString(16) }, \
c: ${cpu.r_c.toString(16)}, d: ${cpu.r_d.toString(16)}, e: ${cpu.r_e.toString(16)}, \
h: ${cpu.r_h.toString(16)}, l: ${cpu.r_l.toString(16)}, IE: ${mem.int_en.toString(16)}, \
IF: ${mem.int_flag.toString(16)} LCDC: ${mem.lcd_control.toString(16)} \
line: ${display.last_scanline}`;
        
        cpu.run();
    }

    display.draw_scanline();
    if(mem.lcd_y == video.GB_VBLANK_START_LINE) {
        cpu.send_interrupt(IRQ.VBlank);
    }
    
    setTimeout(run, 1);
}

start()
