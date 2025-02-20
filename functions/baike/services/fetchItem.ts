import { getItemList } from "./fetchItemList.ts";

import { ensureLink } from "../utils/ensureLink.ts";
import { ensureTitle } from "../utils/ensureTitle.ts";
import { fetchItemLink } from "../utils/fetchItemLink.ts";
import { responseWithBaseRes } from "../utils/responseWithBaseRes.ts";

interface BaikeItem {
    itemName: string;
    cover: string;
    description: string;
    updateTime: string;
    link: string;
    isComplete: true;
}

const itemCache = new Map<string, BaikeItem>();

const Regs = [
    /og:title" content="(.*)"/,
    /og:image" content="(.*)"/,
    /og:description" content="(.*)"/,
    /og:url" content="(.*)"/,
    /dateUpdate" content="(.*)"/,
];

export const fetchItem = async (
    item: string,
    n: string | null,
    encoding = "json"
) => {
    if (itemCache.has(`${item}-${n}`)) {
        const itemInfo = itemCache.get(`${item}-${n}`);
        console.warn("itemCache:", itemInfo);
        if (itemInfo.itemName) {
            if (encoding === "text") {
                return new Response(itemInfo?.description);
            } else {
                return responseWithBaseRes(itemInfo);
            }
        }
    }

    let link = "";

    if (!n) {
        link = await fetchItemLink(item);

        if (!link) {
            if (encoding === "text") {
                return new Response("词条不存在");
            } else {
                return responseWithBaseRes({}, 404, "词条不存在");
            }
        }
    } else {
        const linkListInfo = await getItemList(item);

        if (!linkListInfo) {
            if (encoding === "text") {
                return new Response("词条不存在");
            } else {
                return responseWithBaseRes({}, 404, "词条不存在");
            }
        }

        if (!/^\d+$/.test(n)) {
            if (encoding === "text") {
                return new Response("n 必须为正整数");
            } else {
                return responseWithBaseRes({}, 400, "n 必须为正整数");
            }
        }

        const size = linkListInfo.list.length;

        if (Number(n) > size || Number(n) < 0) {
            if (encoding === "text") {
                return new Response("n 越界");
            } else {
                return responseWithBaseRes({}, 400, "n 越界");
            }
        }

        link = linkListInfo.list[Number(n) - 1].link;
    }
    let itemName, img, desc, url, date;
    let i = 0;
    do {
        const html = await (await fetch(link)).text();
        console.warn(html.includes('og:description'));
        [itemName, img, desc, url, date] = Regs.map(
            (e) => e.exec(html)?.[1] ?? ""
        );
        console.warn('itemName → ', itemName)
        i++;
    } while (!itemName && i < 3);
    const itemInfo = {
        itemName: ensureTitle(itemName),
        description: desc.slice(0, desc.lastIndexOf("。") + 1),
        cover: img.split("-")[0],
        link: ensureLink(url, true),
        updateTime: date,
        isComplete: desc.lastIndexOf("。") === desc.length - 1 || false,
    };
    console.warn("newItem:", itemInfo);
    itemCache.set(`${item}-${n || 0}`, itemInfo);

    if (encoding === "text") {
        return new Response(itemInfo.description);
    } else {
        return responseWithBaseRes(itemInfo);
    }
};
