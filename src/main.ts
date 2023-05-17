import { Display } from "./display";
import { CPU, IRQ } from "./cpu";
import { Memory } from "./memory";
import { Cartridge } from "./cartridge"

let mem = new Memory;
let display = new Display(mem);
let cpu = new CPU(mem);

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
    for(let i = 0; i < 500; i++) {
        cpu.run();
    }
    cpu.send_interrupt(IRQ.VBlank);
    for(let i = 0; i < 500; i++) {
        cpu.run();
    }
    //cpu.send_interrupt(0x50)
    display.draw_frame();
    setTimeout(run, 20);
}

start()
