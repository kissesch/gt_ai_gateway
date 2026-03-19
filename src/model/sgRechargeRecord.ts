import { Model } from "sutando";
import { inspect, InspectOptions } from "util";

class SgRechargeRecord extends Model {
    table = "recharge_records";

    id!: number;

    user_id!: number;
    amount!: number;
    type!: string; // 'recharge' or 'adjustment'
    remark!: string | null;
    operator!: string | null;

    created_at!: Date;
    updated_at!: Date;

    [inspect.custom](depth: number, options: InspectOptions) {
        return JSON.stringify(this.toData(), null, 2);
    }
}

export { SgRechargeRecord };