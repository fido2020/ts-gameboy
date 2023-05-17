import { Display } from "./display";
import { CPU } from "./cpu";
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

async function run() {
    let cartData = await load_rom();
 
    let cart = new Cartridge(cartData);

    setInterval(function() {
        cpu.run()
    }, 1000);
}

run()
