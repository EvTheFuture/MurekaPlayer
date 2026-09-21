/*
 * Mureka Player - load and play all your Mureka songs
 * Android host, a VPN that only gives the phone an address the car accepts
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

import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.VpnService;
import android.os.ParcelFileDescriptor;

import java.io.IOException;

// Tesla's browser will not open a private address, and the hotspot only
// hands out private ones. This VPN carries no traffic at all. It exists so
// Android gives the phone one more address, 3.3.3.3 unless changed, which
// is not private. The car sends to it through the phone, its gateway, and
// since the address is the phone's own, the request goes straight to the car
// page server. Only this app is inside the VPN, the only route is the
// address itself and it can be bypassed, so nothing else on the phone is
// touched
public class CarVpn extends VpnService {

    static final String ACTION_START = "start";
    static final String ACTION_STOP = "stop";

    // What the VPN is doing, for the notification and the settings panel
    private static volatile String status = "off";

    // The address the VPN holds right now, null when it is down
    private static volatile String active = null;

    private ParcelFileDescriptor tun;
    private String tunAddress;

    static String status() {
        return status;
    }

    static String activeAddress() {
        return active;
    }

    // Set from outside, when the permission question was answered no
    static void setStatus(String text) {

        status = text;
        PlayerService.carChanged();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {

        String action = intent != null ? intent.getAction() : null;

        if (ACTION_STOP.equals(action)) {

            close();
            status = "off";
            PlayerService.carChanged();
            stopSelf();

            return START_NOT_STICKY;
        }

        open(CarSettings.vpnAddress(this));

        // The service that owns the player starts this again when needed
        return START_NOT_STICKY;
    }

    // Bring the VPN up with this address, or move it to a new one
    private void open(String address) {

        if (tun != null && address.equals(tunAddress)) {
            return;
        }

        close();

        String error = null;

        try {

            Builder b = new Builder();

            b.setSession("Mureka car page");

            // Android 14 and later drops packets for a VPN's address that
            // arrive on any other interface, the hotspot included. A ping
            // still works since the kernel answers it itself, but no
            // connection ever reaches the server. The rule is only made for
            // an address that appears once among all networks, and a
            // /31 and a /32 of the same address count as two entries, so
            // Android leaves it out. The /32 comes last, so it is the one
            // the tunnel ends up with
            b.addAddress(address, 31);
            b.addAddress(address, 32);

            // A route to the address itself, so the VPN has one, and it is
            // the phone's own address anyway, so nothing ever goes through
            b.addRoute(address, 32);
            b.addAllowedApplication(getPackageName());

            // A bypassable VPN's routing rules come after the local
            // networks, so the replies go back out on the hotspot
            b.allowBypass();
            b.setMetered(false);
            b.setConfigureIntent(PendingIntent.getActivity(this, 5,
                new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE));

            tun = b.establish();
        } catch (PackageManager.NameNotFoundException | RuntimeException e) {

            tun = null;
            error = "could not start: " + e.getMessage();
        }

        if (tun == null) {

            // No tunnel without an error means the permission is missing,
            // it was never given or another VPN app took over since
            status = error != null ? error : "needs permission, switch it off and on in the settings";
            active = null;
            PlayerService.carChanged();
            stopSelf();

            return;
        }

        tunAddress = address;
        active = address;
        status = "on";
        PlayerService.carChanged();
    }

    // Another VPN app started, or the user turned this one off in Android's
    // settings. The setting stays on, the settings panel says what happened
    @Override
    public void onRevoke() {

        close();
        status = "turned off by Android or another VPN";
        PlayerService.carChanged();

        super.onRevoke();
    }

    @Override
    public void onDestroy() {

        close();

        if ("on".equals(status)) {
            status = "off";
        }

        PlayerService.carChanged();

        super.onDestroy();
    }

    private void close() {

        ParcelFileDescriptor t = tun;

        tun = null;
        tunAddress = null;
        active = null;

        if (t != null) {

            try {
                t.close();
            } catch (IOException e) {
                // Gone either way
            }
        }
    }
}
