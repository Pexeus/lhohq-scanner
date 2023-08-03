const cheerio = require("cheerio")
const fs = require("fs")
const URI = require("urijs")
const { request } = require("undici")

const sites = {}
const cache = {}

async function rq(url) {
    let text

    if (cache[url]) {
        return cache[url]
    }

    try {
        const res = await request(url)
        text = await res.body.text()
    }
    catch {
        //console.log(`request failed: ${url}`);
        return false
    }

    cache[url] = text
    return text
}

function getUrls(paths, url) {
    const results = []

    function relPath(urlComponent) {
        var theUrl = new URI(urlComponent);

        if (theUrl.is("relative")) {
            theUrl = theUrl.absoluteTo(url);
        }

        return theUrl.toString();
    }

    for (let path of paths) {
        if (path.attribs.href != undefined) {
            if (!results.includes(path.attribs.href)) {
                results.push(relPath(path.attribs.href))
            }
        }

        if (path.attribs.src != undefined) {
            if (!results.includes(path.attribs.src)) {
                results.push(relPath(path.attribs.src))
            }
        }
    }

    return results
}

async function scanPage(url) {
    const text = await rq(url)

    if (!text) {
        return false
    }

    const s = cheerio.load(text)

    const images = getUrls(s("img"), url)
    const links = getUrls(s("a"), url)

    return { images: images, links: links }
}

async function walk(url) {
    if (sites[url] != undefined) {
        return
    }

    console.log("scanning ", url);
    const set = await scanPage(url)

    if (!set || sites[url] != undefined) {
        return
    }

    sites[url] = set
    console.log(`[${Object.keys(sites).length}] update: ${url}`);

    for (const link of set.links) {
        if (link.includes("lhohq.")) {
            if (sites[link] == undefined) {
                walk(link)
            }
        }
    }
}

function getDateString() {
    const currentDate = new Date();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Adding 1 to adjust month index
    const day = String(currentDate.getDate()).padStart(2, '0');
    const year = currentDate.getFullYear();

    return `${month}-${day}-${year}`;
}


function init() {
    console.log("pages indexed: ", Object.keys(sites).length);

    setInterval(() => {
        console.log("file update");
        fs.writeFileSync(`./sites-${getDateString()}.json`, JSON.stringify(sites))
    }, 5000)

    walk("http://lhohq.info")
}

init()