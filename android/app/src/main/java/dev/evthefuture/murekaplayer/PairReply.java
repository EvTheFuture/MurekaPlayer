/*
 * Mureka Player - load and play all Mureka songs of an account
 * Android host, the pairing code typed into the pairing notification
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

import android.app.RemoteInput;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

// The answers from the pairing notification: the code typed, or Cancel
public final class PairReply extends BroadcastReceiver {

    static final String ACTION_CODE = "dev.evthefuture.murekaplayer.PAIR_CODE";
    static final String ACTION_CANCEL = "dev.evthefuture.murekaplayer.PAIR_CANCEL";
    static final String KEY_CODE = "code";

    @Override
    public void onReceive(Context context, Intent intent) {

        String action = intent != null ? intent.getAction() : null;

        if (ACTION_CANCEL.equals(action)) {

            HelperStart.cancelPairing(context);
            return;
        }

        if (!ACTION_CODE.equals(action)) {
            return;
        }

        Bundle typed = RemoteInput.getResultsFromIntent(intent);
        CharSequence code = typed != null ? typed.getCharSequence(KEY_CODE) : null;

        HelperStart.code(context, code != null ? code.toString() : "");
    }
}
