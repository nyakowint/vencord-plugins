import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Toasts } from "@webpack/common";

export default definePlugin({
    name: "FakeDeafen",
    description: "make ppl think u ae deafen!!!!!!!!!!",
    authors: [Devs.Ven],

    async start() {
      activate();
    },

    stop() {
    },

    activate() {
        console.log("you're gullible");
    }
});
