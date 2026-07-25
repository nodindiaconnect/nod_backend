import { ethers } from "ethers";
import crypto from "crypto";

const algorithm = "aes-256-cbc";
import dotenv from "dotenv";
dotenv.config();

class jmcHelper {
  static async encrypt(text, key, iv) {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
  }

  // Decrypt
  static async decrypt(encrypted) {
    // console.log(encrypted);
    const key = Buffer.from(process.env.AES_KEY, "hex");
    const iv = Buffer.from(process.env.AES_IV, "hex");
    const decipher = crypto.createDecipheriv(
      algorithm,
      Buffer.from(key, "hex"),
      Buffer.from(iv, "hex")
    );
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  // Generate Unique Private Key and Encrypt both seed and private key
  static async genarateUniqePrivatekey() {
    const wallet = ethers.Wallet.createRandom();
    const key = Buffer.from(process.env.AES_KEY, "hex");
    const iv = Buffer.from(process.env.AES_IV, "hex");

    // console.log(key, "key aes");
    const encryptedSeed = await this.encrypt(wallet.mnemonic.phrase, key, iv);
    const encryptedPrivateKey = await this.encrypt(wallet.privateKey, key, iv);

    return {
      walletadress: wallet.address,
      seedPhrase: encryptedSeed,
      privateKey: encryptedPrivateKey,
      // key: key.toString("hex"),
      // iv: iv.toString("hex"),
    };
  }

  static async decryptWalletData(encryptedSeedPhrase, encryptedPrivateKey) {
    const key = Buffer.from(process.env.AES_KEY, "hex");
    const iv = Buffer.from(process.env.AES_IV, "hex");
    const seedPhrase = await this.decrypt(encryptedSeedPhrase, key, iv);
    const privateKey = await this.decrypt(encryptedPrivateKey, key, iv);

    return {
      seedPhrase,
      privateKey,
    };
  }
}

export default jmcHelper;
