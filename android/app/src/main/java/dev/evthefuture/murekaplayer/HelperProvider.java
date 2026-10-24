/*
 * Mureka Player - load and play all Mureka songs of an account
 * Android host, where the running hotspot helper hands over its Binder
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

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.Binder;
import android.os.Bundle;
import android.os.IBinder;

// The hotspot helper, running as the debugging shell, reaches the app
// here once it has started, and whenever the app's process starts anew,
// and hands over the Binder the app switches the hotspot through. Only
// the shell is listened to. The app's own Binder goes back, so the helper
// can tell when the app's process ends
public class HelperProvider extends ContentProvider {

    // Held as long as the process lives, the helper watches it
    private static final Binder APP = new Binder();

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public Bundle call(String method, String arg, Bundle extras) {

        if (Binder.getCallingUid() != HotspotHelper.SHELL_UID || !HotspotHelper.HANDOVER.equals(method)
            || extras == null) {
            return null;
        }

        IBinder helper = extras.getBinder(HotspotHelper.HANDOVER);

        if (helper == null) {
            return null;
        }

        Hotspot.setHelper(getContext(), helper, extras.getString("version", ""));

        Bundle back = new Bundle();

        back.putBinder("app", APP);
        return back;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
        return null;
    }

    @Override
    public String getType(Uri uri) {
        return null;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] args) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] args) {
        return 0;
    }
}
