/*
 * Mureka Player - load and play all Mureka songs of an account
 * Android host, the app's own connection to the phone's wireless debugging
 *
 * Copyright (C) 2026 EvTheFuture
 * https://github.com/EvTheFuture/MurekaPlayer
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

package dev.evthefuture.murekaplayer;

import android.content.Context;
import android.os.Build;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.math.BigInteger;
import java.nio.file.Files;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Date;

import io.github.muntashirakon.adb.AbsAdbConnectionManager;

import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;

// The app as an adb client of its own phone, the way a computer is one.
// It has its own key, made once and kept in the app's private files, never
// backed up. Wireless debugging is paired with that key once, after that
// the app can connect to it by itself
final class AdbLink extends AbsAdbConnectionManager {

    private static final String KEY_FILE = "adb_key";
    private static final String CERT_FILE = "adb_cert";

    // The name the phone shows among its paired devices
    private static final String NAME = "Mureka Player";

    private static AdbLink instance;

    private final PrivateKey privateKey;
    private final Certificate certificate;

    private AdbLink(Context c) throws Exception {

        setApi(Build.VERSION.SDK_INT);

        File dir = c.getNoBackupFilesDir();
        File keyFile = new File(dir, KEY_FILE);
        File certFile = new File(dir, CERT_FILE);

        if (keyFile.isFile() && certFile.isFile()) {

            byte[] key = Files.readAllBytes(keyFile.toPath());
            byte[] cert = Files.readAllBytes(certFile.toPath());

            privateKey = KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(key));
            certificate = CertificateFactory.getInstance("X.509").generateCertificate(new ByteArrayInputStream(cert));
            return;
        }

        KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");

        gen.initialize(2048, new SecureRandom());

        KeyPair pair = gen.generateKeyPair();
        PublicKey publicKey = pair.getPublic();

        privateKey = pair.getPrivate();

        // Self signed, valid for a long time: wireless debugging trusts the
        // key it was paired with, the dates only have to be sane
        X500Name subject = new X500Name("CN=" + NAME);
        Date from = new Date(System.currentTimeMillis() - 86400000L);
        Date until = new Date(System.currentTimeMillis() + 30L * 365 * 86400000L);
        BigInteger serial = BigInteger.valueOf(new SecureRandom().nextInt() & Integer.MAX_VALUE);
        JcaX509v3CertificateBuilder builder = new JcaX509v3CertificateBuilder(subject, serial, from, until, subject, publicKey);
        ContentSigner signer = new JcaContentSignerBuilder("SHA512withRSA").build(privateKey);

        certificate = new JcaX509CertificateConverter().getCertificate(builder.build(signer));

        write(keyFile, privateKey.getEncoded());
        write(certFile, certificate.getEncoded());
    }

    // The one connection manager, made on first use, off the main thread:
    // making the key takes a moment
    static synchronized AdbLink get(Context c) throws Exception {

        if (instance == null) {
            instance = new AdbLink(c.getApplicationContext());
        }

        return instance;
    }

    // The key and the record of a pairing removed, so the next start pairs
    // anew
    static synchronized void forget(Context c) {

        if (instance != null) {

            try {
                instance.disconnect();
            } catch (IOException e) {
                // Already gone
            }
        }

        instance = null;

        File dir = c.getNoBackupFilesDir();

        new File(dir, KEY_FILE).delete();
        new File(dir, CERT_FILE).delete();
    }

    private static void write(File f, byte[] data) throws IOException {

        try (FileOutputStream out = new FileOutputStream(f)) {
            out.write(data);
        }
    }

    @Override
    protected PrivateKey getPrivateKey() {
        return privateKey;
    }

    @Override
    protected Certificate getCertificate() {
        return certificate;
    }

    @Override
    protected String getDeviceName() {
        return NAME;
    }
}
