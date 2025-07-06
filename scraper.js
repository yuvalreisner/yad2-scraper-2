{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 const cheerio = require('cheerio');\
const Telenode = require('telenode-js');\
const fs = require('fs');\
const config = require('./config.json');\
\
const getYad2Response = async (url) => \{\
    const requestOptions = \{\
        method: 'GET',\
        redirect: 'follow'\
    \};\
    try \{\
        const res = await fetch(url, requestOptions);\
        return await res.text();\
    \} catch (err) \{\
        console.log(err);\
    \}\
\}\
\
const scrapeItemsAndExtractImgUrls = async (url) => \{\
    const yad2Html = await getYad2Response(url);\
    if (!yad2Html) \{\
        throw new Error("Could not get Yad2 response");\
    \}\
    const $ = cheerio.load(yad2Html);\
    const title = $("title");\
    const titleText = title.first().text();\
    if (titleText === "ShieldSquare Captcha") \{\
        throw new Error("Bot detection");\
    \}\
    const $feedItems = $(".feeditem").find(".pic");\
    if (!$feedItems) \{\
        throw new Error("Could not find feed items");\
    \}\
    const imageUrls = [];\
    $feedItems.each((_, elm) => \{\
        const imgSrc = $(elm).find("img").attr('src');\
        if (imgSrc) \{\
            imageUrls.push(imgSrc);\
        \}\
    \});\
    return imageUrls;\
\}\
\
const checkIfHasNewItem = async (imgUrls, topic) => \{\
    const filePath = `./data/$\{topic\}.json`;\
    let savedUrls = [];\
    try \{\
        savedUrls = require(filePath);\
    \} catch (e) \{\
        if (e.code === "MODULE_NOT_FOUND") \{\
            if (!fs.existsSync('data')) \{\
                fs.mkdirSync('data');\
            \}\
            fs.writeFileSync(filePath, '[]');\
        \} else \{\
            console.log(e);\
            throw new Error(`Could not read / create $\{filePath\}`);\
        \}\
    \}\
    let shouldUpdateFile = false;\
    savedUrls = savedUrls.filter(savedUrl => \{\
        shouldUpdateFile = true;\
        return imgUrls.includes(savedUrl);\
    \});\
    const newItems = [];\
    imgUrls.forEach(url => \{\
        if (!savedUrls.includes(url)) \{\
            savedUrls.push(url);\
            newItems.push(url);\
            shouldUpdateFile = true;\
        \}\
    \});\
    if (shouldUpdateFile) \{\
        const updatedUrls = JSON.stringify(savedUrls, null, 2);\
        fs.writeFileSync(filePath, updatedUrls);\
        await createPushFlagForWorkflow();\
    \}\
    return newItems;\
\}\
\
const createPushFlagForWorkflow = () => \{\
    fs.writeFileSync("push_me", "");\
\}\
\
const scrape = async (topic, url) => \{\
    const apiToken = process.env.API_TOKEN || config.telegramApiToken;\
    const chatId = process.env.CHAT_ID || config.chatId;\
    const telenode = new Telenode(\{apiToken\});\
    try \{\
        await telenode.sendTextMessage(`Starting scanning $\{topic\} on link:\\n$\{url\}`, chatId);\
        const scrapeImgResults = await scrapeItemsAndExtractImgUrls(url);\
        const newItems = await checkIfHasNewItem(scrapeImgResults, topic);\
        if (newItems.length > 0) \{\
            const newItemsJoined = newItems.join("\\n----------\\n");\
            const msg = `$\{newItems.length\} new items:\\n$\{newItemsJoined\}`;\
            await telenode.sendTextMessage(msg, chatId);\
        \} else \{\
            await telenode.sendTextMessage("No new items were added", chatId);\
        \}\
    \} catch (e) \{\
        let errMsg = e?.message || "";\
        if (errMsg) \{\
            errMsg = `Error: $\{errMsg\}`;\
        \}\
        await telenode.sendTextMessage(`Scan workflow failed... \uc0\u55357 \u56869 \\n$\{errMsg\}`, chatId);\
        throw new Error(e);\
    \}\
\}\
\
const program = async () => \{\
    await Promise.all(config.projects.filter(project => \{\
        if (project.disabled) \{\
            console.log(`Topic "$\{project.topic\}" is disabled. Skipping.`);\
        \}\
        return !project.disabled;\
    \}).map(async project => \{\
        await scrape(project.topic, project.url);\
    \}));\
\};\
\
program();\
}