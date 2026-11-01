package com.naveenroyal4b3.clearflow;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Prints an HTML page with Android's print screen, which can also save it as a PDF.
 * The app's WebView ignores window.print(), so invoices are printed through this plugin.
 */
@CapacitorPlugin(name = "Print")
public class PrintPlugin extends Plugin {

    // Held until the page has loaded and been handed to the print manager, so it is not
    // garbage-collected mid-render.
    private WebView printView;

    @PluginMethod
    public void print(PluginCall call) {
        String html = call.getString("html");
        String jobName = call.getString("name", "Document");
        if (html == null || html.isEmpty()) {
            call.reject("Nothing to print");
            return;
        }

        getActivity().runOnUiThread(() -> {
            WebView view = new WebView(getActivity());
            view.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView page, String url) {
                    if (page != printView) return;
                    printView = null;
                    PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                    printManager.print(jobName, page.createPrintDocumentAdapter(jobName), new PrintAttributes.Builder().build());
                    call.resolve();
                }
            });
            printView = view;
            view.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
        });
    }
}
