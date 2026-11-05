package rs.geosrbija;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

// Thin native shell: the whole game is the offline web app in assets/.
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // localStorage keeps records and unlocked rounds
        setContentView(web);
        if (state != null) web.restoreState(state);
        else web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        // In a game, Back returns to the menu; on the menu it exits.
        web.evaluateJavascript("(function(){var g=document.getElementById('game');"
            + "if(g.style.display!=='none'){document.getElementById('quit').click();return 1}"
            + "if(document.getElementById('result').style.display!=='none'){document.getElementById('resMenu').click();return 1}return 0})()",
            value -> { if ("0".equals(value)) finish(); });
    }
}
