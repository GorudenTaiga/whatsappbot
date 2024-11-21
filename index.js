const {Client, LocalAuth, MessageMedia} = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { setTimeout } = require('timers/promises');
const axios = require('axios');
const fs = require('fs');
const sharp = require('sharp');

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    console.log('Bot is ready');
});

client.on('group_join', (message) => {
    
});


client.on('message', async message => {
    try {
        const prefix = "bot!";
        const msg = await message;

        const chat = await msg.getChat();
        if (msg.body.startsWith(prefix)) {
            
            const args = parseArguments(msg.body)
            const command = msg.body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase();
            
            console.log(`Arguments : ${args}`); 
            console.log(`Commands : ${command}`);


            console.log(`Message from : ${chat.name}\nMessage Body : ${msg.body}\nMessage Type : ${msg.type}\n`)
            if (msg.hasMedia) {
                //Command yang disertakan gambar
                if (command == 'sticker') {
                    console.log('Image diterima')
                    const media = await msg.downloadMedia();
                    if (media) {
                        const inputPath = './imageTemp/input/input.webp';
                        const outputPath = './imageTemp/output/output.webp';
                        
                        fs.writeFileSync(inputPath, Buffer.from(media.data, 'base64'));
                        
                        sharp(inputPath)
                            .webp({lossless: true})
                            .toFile(outputPath, (err, info) => {
                                if (err) {
                                console.error('Error tidak dapat konversi gambar ke stiker : ', err);
                                message.reply('Terjadi kesalahan saat konversi gambar\n@6287743160171');
                                return;
                            }
                            console.log('Stiker berhasil dibuat : ', info);

                            const stickerMedia = MessageMedia.fromFilePath(outputPath);
                            if (args.length > 0) {
                                chat.sendMessage(stickerMedia, {sendMediaAsSticker: true, stickerAuthor: `Made with GorudenTaiga's Bot`, stickerCategories: 'Bot', stickerName: args.text, mentions: msg.author})
                            }
                            else {
                                chat.sendMessage(stickerMedia, {sendMediaAsSticker: true, stickerAuthor: `Made with GorudenTaiga's Bot`, stickerCategories: 'Bot', mentions: msg.author})
                            }
                            console.log('sticker telah dikirim');
                            fs.unlinkSync(inputPath);
                            fs.unlinkSync(outputPath);
                        });
                    }
                }
            } else if (command == "sticker" && !msg.hasMedia) {
                await chat.sendStateTyping();
                msg.reply('Kirimkan gambar dengan prefix ini untuk diproses menjadi sticker', );
            } else if (command == "ping") {
                await chat.sendStateTyping();
                msg.reply("Bot telah on");
            } else if (command == "setintro") {
                await chat.sendStateTyping();
                
            } else if (command.toLowerCase() == "pixiv") {
                console.log(`Parameter Title yang diterima : ${args.title}\nParameter Mode yang diterima : ${args.mode}`);
                try {
                    msg.reply("Gambar sedang di download")
                    for (let i = 1;i <= parseInt(args.count);i++) {
                        const image = await searchImage(args.title, args.mode, msg);
        
                        if (image && image.length > 0) {
                            const randomImage = image[Math.floor(Math.random() * image.length)];
        
                            const imagePath = `./imageTemp/input/${randomImage.id}.jpg`;
                            const originalUrl = await getImageLink(randomImage.id);
                            console.log("Url : ", originalUrl)
                            await downloadImage(originalUrl, imagePath, randomImage.id, msg);
                            try {
                                console.log("tanpa await");
                                msg.reply(`Berikut adalah gambar untuk tag ${args.title}\nJudul : ${args.title}\nMode : ${args.mode}\nLink : https://pixiv.net/artworks/${randomImage.id}`, undefined, {
                                    media: MessageMedia.fromFilePath(imagePath)
                                })    
                            } catch (e) {
                                console.log("dengan await")
                                await msg.reply(`Berikut adalah gambar untuk tag ${args.title}\nJudul : ${args.title}\nMode : ${args.mode}\nLink : https://pixiv.net/artworks/${randomImage.id}`, undefined, {
                                    media: MessageMedia.fromFilePath(imagePath)
                                })    
                            } finally {
                                fs.unlinkSync(imagePath);
                            }
                        } else {
                            console.log("Image: ", image);
                            msg.reply("gambar tidak ditemukan");
                        }
                    }
                } catch (e) {
                    console.log("Error : ", e);
                    msg.reply("Terjadi kesalahan");
                }
            } 
        }
    }
    catch (err) {
        console.log(`Error : ${err}`)
        message.reply("Terjadi error. Segera mensummon owner @6287743160171")
    }
});

function parseArguments(input) {
    const args = {}
    args.count = 1;
    args.mode = "safe";
    args.title = "";
    const regex = /-([a-zA-Z]+)\s+"([^"]+)"|-([a-zA-Z]+)\s+(\S+)/g;
    let match;

    while ((match = regex.exec(input)) !== null) {
        if (match[1]) {
            args[match[1]] = match[2];
        } else if (match[3]) {
            args[match[3]] = match[4];
        }
    }
    return args;
}

async function searchImage(title, mode, msg) {
    try {
        const response = await axios.get(`https://www.pixiv.net/ajax/search/artworks/${title}?word=${title}&mode=${mode}`, {
            headers: {
                'User-Agent' : 'Mozilla/5.0 (Windows NT 6.1; Win64; x64)',
                'Referer' : 'https://www.pixiv.net/',
                'Accept-Encoding' : 'gzip,deflate,br,zstd',
                'Cookie' : 'PHPSESSID=87338801_xFyT5tXuCjiVn8ZMc45ExWNQbvpuxLRU'
            },
        });

        const illustrations = response.data.body.illustManga.data;
        if (!illustrations || illustrations === 0) {
            msg.reply("Tidak ditemukan gambar dengan tag tersebut");
            return null;
        }
        return illustrations;
    } catch (e) {
        msg.reply("Terjadi kesalahan");
        console.log("Error : ", e);
        return null;
    }
}

async function getImageLink(id) {
    const response = await axios({
        url: `https://www.pixiv.net/ajax/illust/${id}`,
        method: 'get',
        headers: {
            'User-Agent' : 'Mozilla/5.0 (Windows NT 6.1; Win64; x64)',
            'Referer' : `https://www.pixiv.net/artworks/${id}`,
            'Accept-Encoding' : 'gzip,deflate,br,zstd',
            'Cookie' : 'PHPSESSID=87338801_xFyT5tXuCjiVn8ZMc45ExWNQbvpuxLRU'
        }
    });
    const data = response.data;
    const originalurl = data.body.urls.original;
    return originalurl;
}

async function downloadImage(url, path, id, msg) {
    try {
        const response = await axios({
            url: url.replace('\\', ''),
            method: 'get',
            responseType: 'stream',
            headers: {
                'User-Agent' : 'Mozilla/5.0 (Windows NT 6.1; Win64; x64)',
                'Referer' : `https://www.pixiv.net/member_illust.php?mode=medium&illust_id=${id}`,
                'Accept-Encoding' : 'gzip,deflate,br,zstd',
                'Cookie' : 'PHPSESSID=87338801_xFyT5tXuCjiVn8ZMc45ExWNQbvpuxLRU'
            }
        });
        await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(path);
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        // fs.writeFileSync(path, Buffer.from(response.data, 'base64'));
        console.log('Gambar berhasil diunduh');
    } catch (e) {
        console.log('Gambar gagal diunduh : ', e);
    }
}

client.initialize();

