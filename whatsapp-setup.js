import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import readline from 'readline';
import chalk from 'chalk';
import Boom from '@hapi/boom'; // Pastikan 'Boom' diimpor

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (text) => new Promise((resolve) => rl.question(text, resolve));

const startSession = async () => {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true // Menampilkan QR code di terminal
        });

        // Menampilkan prompt dan mendapatkan nomor telepon
        const phoneNumber = await question(chalk.blueBright.bold('Masukkan nomor telepon (dengan kode negara): '));
        
        // Coba untuk mendapatkan kode pairing
        try {
            let code = await sock.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(
                chalk.bgMagentaBright.white.bold(' Kode Pairing: ') +
                chalk.bgBlack.white.bold(` ${code} `)
            );
        } catch (error) {
            console.error(chalk.red.bold('Gagal menghasilkan kode pairing:'), error);
        }

        // Menangani pembaruan koneksi
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                switch (reason) {
                    case DisconnectReason.loggedOut:
                        console.log(chalk.yellow.bold('Logout, silakan pindai QR code lagi.'));
                        process.exit(1);
                        break;
                    case DisconnectReason.connectionReplaced:
                        console.log(chalk.yellow.bold('Koneksi digantikan, tutup sesi lain.'));
                        process.exit(1);
                        break;
                    case DisconnectReason.restartRequired:
                        console.log(chalk.yellow.bold('Diperlukan restart, memulai ulang...'));
                        startSession();
                        break;
                    default:
                        console.log(chalk.red.bold('Koneksi ditutup karena alasan tidak diketahui.'));
                        process.exit(1);
                }
            } else if (connection === 'open') {
                console.log(chalk.green.bold('Koneksi berhasil dibuka!'));
            }
        });

        // Menyimpan kredensial saat diperbarui
        sock.ev.on('creds.update', saveCreds);
    } catch (error) {
        console.error(chalk.red.bold('Terjadi kesalahan:'), error);
    } finally {
        rl.close();
    }
};

startSession();
