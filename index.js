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
                    const image = await searchImage(args.title, args.mode, msg);
    
                    if (image && image.length > 0) {
                        const randomImage = image[Math.floor(Math.random() * image.length)];
                        const imageUrl = randomImage.url;
    
                        const imagePath = `./imageTemp/input/${randomImage.id}.jpg`;
                        fs.writeFileSync(imagePath, Buffer.from(media.data, 'base64'));
                        await downloadImage(imageUrl, imagePath);
    
                        await msg.reply(`Berikut adalah gambar untuk tag ${args.title}\nJudul : ${args.title}\nMode : ${args.mode}\nLink : https://pixiv.net/artworks/${randomImage.id}`, undefined, {
                            media: fs.createReadStream(imagePath)
                        })
    
                        fs.unlinkSync(imagePath);
                    } else {
                        console.log("Image: ", image);
                        msg.reply("gambar tidak ditemukan");
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
    const args = input.match(/-\w+=\S+/g);
    const parameter = {};
    
    if (args) {
        args.forEach(arg => {
            const [key, value] = arg.split('=');
            if (key && value) {
                parameter[key.replace('-', '').toLowerCase()] = value;
            }
        })
    }
    return parameter;
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

async function downloadImage(url, path) {
    try {
        const response = await axios({
            url: url,
            method: 'get',
            responseType: 'stream'
        });

        /* await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(path);
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        }); */
        fs.writeFileSync(path, Buffer.from(response.data, 'base64'));

        console.log('Gambar berhasil diunduh');
    } catch (e) {
        console.log('Gambar gagal diunduh : ', e);
    }
}

client.initialize();

