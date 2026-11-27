/*
 * Mureka Player - load and play all Mureka songs of an account
 * Android host, the web view's own certificate for https
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
import android.content.SharedPreferences;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.Key;
import java.security.KeyFactory;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.security.spec.PKCS8EncodedKeySpec;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Enumeration;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLServerSocketFactory;

// The web view's own certificate and key, for serving it over https too, so
// a browser allows what it only allows on a secure page, the microphone
// first of all, and remembers that it did. Brought in from a browser as
// PEM, a certificate or a chain and its private key, or as a PKCS #12 file
// with its password. Kept in the app's own files as PKCS #12 under a
// password of its own, made at random and kept in the app's settings
final class TlsKeys {

    private static final String FILE = "webview-tls.p12";
    private static final String PREFS = "webview_tls";
    private static final String PASS = "pass";
    private static final String ALIAS = "webview";

    private TlsKeys() {
    }

    private static File file(Context c) {
        return new File(c.getFilesDir(), FILE);
    }

    static boolean have(Context c) {
        return file(c).isFile();
    }

    // The store's own password, made the first time it is needed
    private static char[] pass(Context c) {

        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String v = p.getString(PASS, null);

        if (v == null) {

            byte[] raw = new byte[24];

            new SecureRandom().nextBytes(raw);
            v = Base64.encodeToString(raw, Base64.NO_WRAP);
            p.edit().putString(PASS, v).apply();
        }

        return v.toCharArray();
    }

    private static KeyStore load(Context c) throws GeneralSecurityException, IOException {

        KeyStore ks = KeyStore.getInstance("PKCS12");

        try (InputStream in = new FileInputStream(file(c))) {
            ks.load(in, pass(c));
        }

        return ks;
    }

    // What serves https with the key kept, null without one
    static SSLServerSocketFactory factory(Context c) throws GeneralSecurityException, IOException {

        if (!have(c)) {
            return null;
        }

        KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        SSLContext ctx = SSLContext.getInstance("TLS");

        kmf.init(load(c), pass(c));
        ctx.init(kmf.getKeyManagers(), null, new SecureRandom());

        return ctx.getServerSocketFactory();
    }

    static void remove(Context c) {

        File f = file(c);

        if (f.isFile() && !f.delete()) {
            f.deleteOnExit();
        }
    }

    // The certificate and its key from PEM text: one or more certificates,
    // the web view's first, and a private key, PKCS #8 or an RSA key as
    // OpenSSL writes it the old way. Checked to belong together
    static void importPem(Context c, String certPem, String keyPem) throws GeneralSecurityException, IOException {

        List<X509Certificate> chain = new ArrayList<>();
        CertificateFactory cf = CertificateFactory.getInstance("X.509");
        Matcher m = Pattern.compile("-----BEGIN CERTIFICATE-----(.*?)-----END CERTIFICATE-----", Pattern.DOTALL).matcher(certPem);

        while (m.find()) {
            chain.add((X509Certificate) cf.generateCertificate(new ByteArrayInputStream(unbase(m.group(1)))));
        }

        if (chain.isEmpty()) {
            throw new GeneralSecurityException("No certificate found, it starts with -----BEGIN CERTIFICATE-----");
        }

        save(c, readKey(keyPem), chain.toArray(new Certificate[0]));
    }

    // From a PKCS #12 file and its password: the first key in it and the
    // certificates that go with it
    static void importP12(Context c, byte[] p12, char[] password) throws GeneralSecurityException, IOException {

        KeyStore in = KeyStore.getInstance("PKCS12");

        in.load(new ByteArrayInputStream(p12), password);

        Enumeration<String> names = in.aliases();

        while (names.hasMoreElements()) {

            String a = names.nextElement();

            if (!in.isKeyEntry(a)) {
                continue;
            }

            Key k = in.getKey(a, password);
            Certificate[] chain = in.getCertificateChain(a);

            if (k instanceof PrivateKey && chain != null && chain.length > 0) {

                save(c, (PrivateKey) k, chain);
                return;
            }
        }

        throw new GeneralSecurityException("No private key with its certificate in the file");
    }

    private static void save(Context c, PrivateKey key, Certificate[] chain) throws GeneralSecurityException, IOException {

        matches(key, chain[0]);

        KeyStore ks = KeyStore.getInstance("PKCS12");
        File f = file(c);
        File tmp = new File(f.getPath() + ".new");

        ks.load(null, null);
        ks.setKeyEntry(ALIAS, key, pass(c), chain);

        try (FileOutputStream out = new FileOutputStream(tmp)) {
            ks.store(out, pass(c));
        }

        if (!tmp.renameTo(f)) {

            tmp.delete();
            throw new IOException("The certificate could not be kept");
        }

        // Read back once, so a store this Android cannot read is found now
        try {
            factory(c);
        } catch (GeneralSecurityException | IOException e) {

            remove(c);
            throw e;
        }
    }

    // The key and the certificate belong together: something signed with
    // the one checks out with the other
    private static void matches(PrivateKey key, Certificate cert) throws GeneralSecurityException {

        if (!key.getAlgorithm().equals(cert.getPublicKey().getAlgorithm())) {
            throw new GeneralSecurityException("The private key does not belong to the certificate");
        }

        String alg = "EC".equals(key.getAlgorithm()) ? "SHA256withECDSA" : "SHA256withRSA";
        byte[] probe = new byte[32];
        Signature s = Signature.getInstance(alg);
        Signature v = Signature.getInstance(alg);

        new SecureRandom().nextBytes(probe);
        s.initSign(key);
        s.update(probe);
        v.initVerify(cert.getPublicKey());
        v.update(probe);

        if (!v.verify(s.sign())) {
            throw new GeneralSecurityException("The private key does not belong to the certificate");
        }
    }

    private static PrivateKey readKey(String pem) throws GeneralSecurityException {

        Matcher pk8 = Pattern.compile("-----BEGIN PRIVATE KEY-----(.*?)-----END PRIVATE KEY-----", Pattern.DOTALL).matcher(pem);
        Matcher rsa = Pattern.compile("-----BEGIN RSA PRIVATE KEY-----(.*?)-----END RSA PRIVATE KEY-----", Pattern.DOTALL).matcher(pem);
        byte[] der;

        if (pk8.find()) {
            der = unbase(pk8.group(1));
        } else if (rsa.find()) {
            der = rsaToPkcs8(unbase(rsa.group(1)));
        } else if (pem.contains("ENCRYPTED PRIVATE KEY") || pem.contains("Proc-Type: 4,ENCRYPTED")) {
            throw new GeneralSecurityException("The private key has a password; make it without one (openssl pkcs8 -topk8 -nocrypt)");
        } else {
            throw new GeneralSecurityException("No private key found, it starts with -----BEGIN PRIVATE KEY----- (openssl pkcs8 -topk8 -nocrypt makes one)");
        }

        // RSA or EC, whichever reads it
        GeneralSecurityException last = null;

        for (String alg : new String[] {"RSA", "EC"}) {

            try {
                return KeyFactory.getInstance(alg).generatePrivate(new PKCS8EncodedKeySpec(der));
            } catch (GeneralSecurityException e) {
                last = e;
            }
        }

        throw new GeneralSecurityException("The private key could not be read" + (last != null ? ": " + last.getMessage() : ""));
    }

    private static byte[] unbase(String text) {
        return Base64.decode(text.replaceAll("\\s", ""), Base64.DEFAULT);
    }

    // An RSA key the old way, PKCS #1, wrapped as PKCS #8: the version, the
    // algorithm rsaEncryption and the key as an octet string
    private static byte[] rsaToPkcs8(byte[] pkcs1) {

        byte[] version = {0x02, 0x01, 0x00};
        byte[] algorithm = {0x30, 0x0d, 0x06, 0x09, 0x2a, (byte) 0x86, 0x48, (byte) 0x86, (byte) 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00};
        ByteArrayOutputStream inner = new ByteArrayOutputStream();

        inner.write(version, 0, version.length);
        inner.write(algorithm, 0, algorithm.length);
        der(inner, 0x04, pkcs1);

        ByteArrayOutputStream outer = new ByteArrayOutputStream();

        der(outer, 0x30, inner.toByteArray());

        return outer.toByteArray();
    }

    private static void der(ByteArrayOutputStream out, int tag, byte[] content) {

        int n = content.length;

        out.write(tag);

        if (n < 0x80) {
            out.write(n);
        } else if (n < 0x100) {

            out.write(0x81);
            out.write(n);
        } else if (n < 0x10000) {

            out.write(0x82);
            out.write(n >> 8);
            out.write(n & 0xff);
        } else {

            out.write(0x83);
            out.write(n >> 16);
            out.write((n >> 8) & 0xff);
            out.write(n & 0xff);
        }

        out.write(content, 0, n);
    }

    // What the browser shows of the certificate kept: whom it is for, its
    // names, until when, and its SHA-256 fingerprint to compare with the
    // browser's. Only on, the port, with none
    static JSONObject info(Context c, int port) {

        JSONObject o = new JSONObject();

        try {

            o.put("on", false);
            o.put("port", port);

            if (!have(c)) {
                return o;
            }

            KeyStore ks = load(c);
            Certificate cert = ks.getCertificate(ALIAS);

            if (!(cert instanceof X509Certificate)) {
                return o;
            }

            X509Certificate x = (X509Certificate) cert;
            SimpleDateFormat day = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT);
            JSONArray names = new JSONArray();
            StringBuilder fp = new StringBuilder();

            day.setTimeZone(TimeZone.getTimeZone("UTC"));

            for (byte b : MessageDigest.getInstance("SHA-256").digest(x.getEncoded())) {

                if (fp.length() > 0) {
                    fp.append(':');
                }

                fp.append(String.format(Locale.ROOT, "%02X", b & 0xff));
            }

            Collection<List<?>> alt = x.getSubjectAlternativeNames();

            if (alt != null) {

                for (List<?> e : alt) {

                    if (e.size() > 1 && e.get(1) instanceof String) {
                        names.put(e.get(1));
                    }
                }
            }

            o.put("on", true);
            o.put("subject", x.getSubjectX500Principal().getName());
            o.put("names", names);
            o.put("until", day.format(x.getNotAfter()));
            o.put("sha256", fp.toString());
        } catch (JSONException | GeneralSecurityException | IOException e) {

            try {
                o.put("error", String.valueOf(e.getMessage()));
            } catch (JSONException ignored) {
                // Nothing more to tell
            }
        }

        return o;
    }
}
