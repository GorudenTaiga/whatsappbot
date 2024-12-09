const {Client, LocalAuth, MessageMedia} = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { setTimeout } = require('timers/promises');
const puppeteer = require('puppeteer')
const express = require('express')
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const client = new Client({
    restartOnAuthFail: true,
    webVersionCache: {
        type: "remote",
        remotePath:
          "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2410.1.html",
      },
      puppeteer: {
        executablePath: puppeteer.executablePath(),
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process", 
          "--disable-gpu",
        ],
      },
      authStrategy: new LocalAuth({
        clientId: 'bot', // Nama folder untuk menyimpan file session
        dataPath: path.join('/tmp', '.wwebjs_auth') // Direktori writable
    }),
});



// Server untuk menjaga koneksi tetap hidup
const app = express();
app.get('/', (req, res) => {
    res.send('WhatsApp Bot is running!');
});
app.listen(3000, () => {
    console.log('Server is live at port 3000');
});


let qrCodeData
app.get('/qr', async (req, res) => {
    if (qrCodeData) {
        const qrCodeImage = await qrcode.toDataURL(qrCodeData);
        res.setHeader('Content-Type', 'text/html');
        res.send(`<img src="${qrCodeImage}" alt="QR Code" />`);
    } else {
        res.send('QR Code is not yet generated. Please wait.');
    }
});

client.on('qr', qr => {
    qrcodeData = qr
    console.log("QR Dibuat")
});

client.on('disconnected', (reason) => {
    console.log("Bot Disconnected : ", reason)
    client.initialize()
})

client.on('ready', () => {
    console.log('Bot is ready');
});

client.on('group_leave', async (notif) => {
    try {
        const msg = await notif.getChat();
        const userId = notif.id.participant;
        const contact = userId.split('@')[0];
        let data = readJsonData('./jsonData/outro.json');
        data = Object.values(data).find((item) => item.groupId === msg.name);
        console.log(data);
        console.log(String("Outro : " + data.outro))
        if (data) {
            if (data.outro.includes("<username>")) {
                data.outro = data.outro.replaceAll("<username>", `@${contact}`)
            }
            msg.sendMessage(data.outro, {mentions: [userId]})
        }
    } catch (e) {
        console.log("Group Leave error : ", e)
    }
})

client.on('group_join', async (notif) => {
    try {
        const msg = await notif.getChat()
        const userId= notif.id.participant
        const contact = userId.split('@')[0]
        let data = readJsonData('./jsonData/intro.json')
        data = Object.values(data).find((item) => item.groupId === msg.name)
        console.log(data)
        if (data) {
            if (data.intro.includes("<username>")) {
                data.intro = data.intro.replaceAll("<username>", `@${contact}`)
            }
            msg.sendMessage(data.intro, {mentions: [userId]})
        }
    } catch (e) {
        console.log("Error : ", e)
    }
});

const activeQuiz = {}

const commandsHelp = {
    'ping': 'bot!ping : Mengetes apakah bot sudah aktif atau belum\nContoh pemakaian : bot!ping\n\n',
    'setintro': 'bot!setintro -intro <text> : Membuat sebuah pesan intro saat terdapat member baru di grup\nParameter yang dapat di isi :\n-intro : digunakan untuk menambahkan pesan intro (Jangan lupa gunakan tanda " " untuk pembuka dan penutup intro)\n-update : digunakan untuk mengupdate pesan intro yang sudah ada\nGunakan <username> untuk menambahkan mention ke orang yang baru join\n\nContoh penggunaan : bot!setintro -intro "Hello <username>, Perkenalan dulu yuk\nNama : \nGender : \nUmur : \nWaifu : \n\nSalam Kenal 😊" -update',
    'setoutro': 'bot!setoutro -outro <text> : Membuat sebuah pesan outro saat terdapat member keluar dari grup\nParameter yang dapat di isi :\n-outro : digunakan untuk menambahkan pesan outro (Jangan lupa gunakan tanda " " untuk pembuka dan penutup outro)\n-update : digunakan untuk mengupdate pesan outroyang sudah ada\nGunakan <username> untuk menambahkan mention ke orang yang baru leave\n\nContoh penggunaan : bot!setoutro -outro "Selamat tinggal <username>, semoga kamu lebih bahagia diluar sana" -update',
    'sticker': 'bot!sticker -text <text> : Konversi gambar dengan nama sesuai keinginan user\nbot!sticker : Konversi gambar menjadi sebuah sticker\nParameter yang bisa digunakan :\n-text : digunakan untuk mengisi text yang ingin digunakan sebagai nama dari stickermu\nCara pemakaian :\n1. Pilih gambar yang ingin dijadikan sticker (Diusahakan 1:1)\n2.Ketikkan command bot!sticker\n(Opsional) Jika ingin menamai sticker tersebut, maka berikan spasi setelah bot!sticker dan ketikkan nama stickermu\nContoh tanpa parameter : bot!sticker\nContoh dengan parameter : bot!sticker Ini adalah tes',
    'pixiv': 'bot!pixiv -title <title> -count <count> : Command ini ditujukan untuk mencarikan gambar sesuai keinginan pengguna\n\nParameter yang dapat di isi :\n-title : digunakan untuk mengisikan tag yang ingin kamu cari (Disarankan menggunakan bahasa jepang)\n-count : digunakan untuk mengisikan jumlah gambar yang kalian inginkan (Sementara maksimal 25)\n\nContoh pemakaian : bot!pixiv -title "丹花イブキ ロリ" -count 1',
    'help': 'Prefix : bot!\nCommands:\nping    sticker   pixiv\nsetintro    setoutro\n\nbot!help <command> : Melihat bantuan dari command yang ingin kamu gunakan\nbot!help : Melihat bantuan secara umum\nCommand ini digunakan untuk menampilkan tampilan ini'
}

function saveLeaderboard(data) {
    fs.writeFileSync(`./jsonData/leaderboard.json`, JSON.stringify(data, null, 2), 'utf-8');
}

function readLeaderboardData() {
    if (fs.existsSync('./jsonData/leaderboard.json')) {
        try {
            const data = JSON.parse(fs.readFileSync('./jsonData/leaderboard.json', 'utf8'));
            // Validasi apakah data berupa array
            if (Array.isArray(data)) {
                return data;
            } else {
                console.log('Invalid JSON structure. Resetting to empty array.');
                return [];
            }
        } catch (error) {
            console.error('Error parsing JSON:', error);
            return [];
        }
    }
    console.log('File not found. Returning empty array.');
    return [];
}

function updateLeaderboard(groupId, userId, point) {
    let leaderboard = readLeaderboardData();

    let groupData = leaderboard.find((item) => item.groupId === groupId)
    if (!groupData) {
        groupData = {groupId, data: {}};
        leaderboard.push(groupData);
    }
    groupData.data[userId] = (groupData.data[userId] || 0) + point
    
    saveLeaderboard(leaderboard)
}

client.on('message', async message => {
    try {
        const prefix = "bot!";
        const msg = message;
        const chat = await msg.getChat();
        const contact = await msg.getContact()
        if (msg.body.startsWith(prefix)) {
            
            const args = parseArguments(msg.body);

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
                        const inputPath = '../imageTemp/input/input.webp';
                        const outputPath = '../imageTemp/output/output.webp';
                        
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
                            if (args.text) {
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
                msg.reply('Kirimkan gambar dengan prefix ini untuk diproses menjadi sticker, ketik `bot!help sticker` untuk lebih lengkapnya', );
            } else if (command == "ping") {
                await chat.sendStateTyping();
                msg.reply("Bot telah on");
            } else if (command == "help") {
                await chat.sendStateTyping();
                const help = msg.body.slice(prefix.length + command.length).trim().split(/ +/).shift().toLowerCase()
                console.log("Help : ", help);
                if (help == "pixiv") {
                    msg.reply(commandsHelp.pixiv);
                } else if (help == "ping") {
                    msg.reply(commandsHelp.ping);
                } else if (help == "sticker") {
                    msg.reply(commandsHelp.sticker);
                } else if (help == "setoutro") {
                    msg.reply(commandsHelp.setoutro)
                } else if (help == "setintro") {
                    msg.reply(commandsHelp.setintro)
                } else {
                    msg.reply(commandsHelp.help)
                }
            } else if (command == "setintro") {
                await chat.sendStateTyping();
                if (msg.from.includes('@g.us')) {
                    try {
                        let data = readJsonData('./jsonData/intro.json')
                        data = data.find((item) => item.groupId === chat.name)
                        if (data) {
                            console.log(`JSON Data Intro :\n${data}`)
                            data.intro = args.intro;
                            try {
                                fs.writeFileSync('./jsonData/intro.json', JSON.stringify(data, null, 2), 'utf-8');
                                msg.reply("Berhasil mengupdate intro")
                            } catch (e) {
                                console.log("Error : ", e)
                                msg.reply("Gagal mengupdate intro")
                            }
                        } else {
                            msg.reply("Data grup tidak ditemukan, segera dibuatkan intro")
                            const inputData = {
                                groupId: chat.name,
                                createdBy: msg.author,
                                intro: args.intro
                            }
                            data.push(inputData);
                            try {
                                fs.writeFileSync('./jsonData/intro.json', JSON.stringify(data, null, 2), 'utf-8')
                                msg.reply("Intro sudah berhasil ditambah")
                            } catch (e) {
                                console.log("Error : ", e)
                                msg.reply("Data gagal disimpan")
                            }
                        }
                    } catch (e) {
                        console.log("Error : ", e)
                        msg.reply(e)
                    }
                } else {
                    msg.reply("Anda sedang tidak berada di grup")
                }
            } else if (command == "setoutro") {
                await chat.sendStateTyping();
                if (msg.from.includes('@g.us')) {
                    if (args.update) {
                        try {
                            let data = readJsonData('./jsonData/outro.json')
                            data = data.find((item) => item.groupID === chat.name)
                            if (data) {
                                console.log(`JSON Data outro :\n${data}`)
                                data.outro = args.outro;
                                try {
                                    fs.writeFileSync('./jsonData/outro.json', JSON.stringify(data, null, 2), 'utf-8');
                                    msg.reply("Berhasil mengupdate outro")
                                } catch (e) {
                                    console.log("Error : ", e)
                                    msg.reply("Gagal mengupdate outro")
                                }
                            } else {
                                msg.reply("Data grup tidak ditemukan, buat outro baru terlebih dahulu")
                            }
                        } catch (e) {
                            console.log("Error : ", e)
                            msg.reply(e)
                        }
                    } else {
                        try {
                            let data = readJsonData('./jsonData/outro.json')
                            const inputData = {
                                groupId: chat.name,
                                createdBy: msg.author,
                                outro: args.outro
                            }
                            if (data) {
                                data.push(inputData);
                                try {
                                    fs.writeFileSync('./jsonData/outro.json', JSON.stringify(data, null, 2), 'utf-8')
                                    msg.reply("outro sudah berhasil ditambah")
                                } catch (e) {
                                    console.log("Error : ", e)
                                    msg.reply("Data gagal disimpan")
                                }
                            }
                        } catch (e) {
                            msg.reply("Terjadi kesalahan | @6287743160171");
                        }
                    }
                } else {
                    msg.reply("Anda sedang tidak berada di grup")
                }
            } else if (command.toLowerCase() == "pixiv") {
                console.log(`Parameter Title yang diterima : ${args.title}\nParameter Mode yang diterima : ${args.mode}`);
                try {
                    msg.reply("Gambar sedang di download")
                    const image = await searchImage(args.title, 'safe', msg);
                    for (let i = 1;i <= parseInt(args.count);i++) {
                        if (image && image.length > 0) {
                            const randomImage = image[Math.floor(Math.random() * image.length)];
        
                            const imagePath = `../imageTemp/input/${randomImage.id}.jpg`;
                            const originalUrl = await getImageLink(randomImage.id);
                            console.log("Url : ", originalUrl)

                            await downloadImage(originalUrl, imagePath, randomImage.id, msg);

                            try {
                                console.log("tanpa await");
                                msg.reply(`Berikut adalah gambar untuk tag ${args.title}\nJudul : ${args.title}\nMode : Safe\nLink : https://pixiv.net/artworks/${randomImage.id}`, undefined, {
                                    media: MessageMedia.fromFilePath(imagePath)
                                })    
                            } catch (e) {
                                console.log("dengan await")
                                await msg.reply(`Berikut adalah gambar untuk tag ${args.title}\nJudul : ${args.title}\nMode : Safe\nLink : https://pixiv.net/artworks/${randomImage.id}`, undefined, {
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
                    try {
                        msg.reply("Terjadi kesalahan");
                    } catch (e) {
                        console.log("Error : ", e)
                    }
                }
            } else if (command == "startquiz") {
                await chat.sendStateTyping();
                let quest = JSON.parse(fs.readFileSync('./jsonData/questions.json', 'utf-8'));
                quest = Object.values(quest).filter((item) => item.difficulty == (args.diff || 'medium'));

                const randomIndex = Math.floor(Math.random() * quest.length);
                const currentQuest = quest[randomIndex];
                
                activeQuiz[chat.id._serialized] = currentQuest;
                
                chat.sendMessage(`Quiz dimulai!\nQuiz : ${currentQuest.question}`);
                console.log(activeQuiz)
            } else if (command == "leaderboard") {
                let board = 'Leaderboard : \n';
                let leaderboard = readLeaderboardData();
                leaderboard = leaderboard.filter((item) => item.groupId == chat.id._serialized).forEach((item) => {
                    Object.keys(item.data).forEach(userId => {
                        const point = item.data[userId];
                        board += `${userId.split('@')[0]} : ${point}\n`
                    })
                })
                
                msg.reply(board)
            }
        }
        if (activeQuiz[chat.id._serialized]) {
            const currentQuiz = activeQuiz[chat.id._serialized];
            console.log("Question : ", currentQuiz.question.toLowerCase())
            console.log("Answer : ", currentQuiz.answer.toLowerCase());
            console.log("Choose : ", msg.body.toLowerCase())
            if (msg.body.toLowerCase().includes(currentQuiz.answer.toLowerCase())) {
                updateLeaderboard(chat.id._serialized, contact.pushname, currentQuiz.point)                
                
                msg.reply(`Jawaban Benar! 🎉\nKamu meraih point : ${currentQuiz.point}`);
                delete activeQuiz[chat.id._serialized]
            } 
        }
    } catch (err) {
        console.log(`Error : ${err}`)
    }
});

function parseArguments(input) {
    const args = {}
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

function readJsonData(path) {
    let rawData = fs.readFileSync(path, 'utf-8')
    let data = JSON.parse(rawData);
    if (!data) {
        throw new Error("Tidak dapat membaca data");
    }
    return data;
}



// Start Function Pixiv
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
        console.log("Error : ", e);
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
//End Function Pixiv






client.initialize();

