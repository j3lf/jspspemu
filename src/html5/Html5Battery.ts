import { BatteryInfo } from '../core/battery';
import {PromiseFast} from "../global/utils";

export interface BatteryManager {
    charging: boolean;
    chargingTime: number;
    dischargingTime: number;
    level: number;
    //onchargingchange: any;
    //onchargingtimechange: any;
    //ondischargingtimechange: any;
    //onlevelchange: any;
}

export class Html5Battery {
    static instance: Html5Battery = null;
    private static promise: PromiseFast<Html5Battery> = null;

    constructor(private manager: BatteryManager) {
        Html5Battery.instance = this;
    }

    get lifetime() {
        // Up to 10 hours, to avoid too high/infinite values
        if (this.manager != null) return Math.min(10 * 3600, this.manager.dischargingTime);
        return 3 * 3600;
    }

    get charging() {
        if (this.manager != null) return this.manager.charging;
        return true;
    }

    get level(): number {
        if (this.manager != null) return this.manager.level;
        return 1.0;
    }

    static getAsync(): PromiseFast<Html5Battery> {
        if (this.instance) return PromiseFast.resolve(this.instance);
        if (this.promise) return this.promise;
        if ((<any>navigator).battery) return PromiseFast.resolve(new Html5Battery((<any>navigator).battery));
        if ((<any>navigator).getBattery) {

            return this.promise = PromiseFast.fromThenable<BatteryManager>((<any>navigator).getBattery()).then(v => {
                return new Html5Battery(v);
            });
        }
        return PromiseFast.resolve(new Html5Battery(null));
    }

    static registerAndSetCallback(callback: (bi: BatteryInfo) => void) {
        setTimeout(() => {
			Html5Battery.getAsync().then(battery => {
				function sendData(): void {
                    callback(<BatteryInfo>{
						charging: battery.charging,
						level: battery.level,
						lifetime: battery.lifetime,
					});
				}
				setInterval(() => {
					sendData();
				}, 300);
				sendData();
			});
		}, 0);
    }
}


		