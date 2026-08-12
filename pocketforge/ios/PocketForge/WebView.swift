import SwiftUI
import WebKit

/// Embedded browser for the live app preview, tuned for sandboxed web apps:
/// inline media, no link previews, pull-to-refresh.
struct WebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let webView = makeConfiguredWebView(coordinator: context.coordinator)
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        if webView.url == nil {
            webView.load(URLRequest(url: url))
        }
    }

    func makeCoordinator() -> WebViewCoordinator { WebViewCoordinator() }
}

/// Renders generated project files on-device when the cloud sandbox is
/// unavailable (e.g. Daytona out of credits). Writes the file tree to a temp
/// directory and loads `index.html` with read access so relative CSS/JS work.
struct LocalFileWebView: UIViewRepresentable {
    let files: [ProjectFile]
    let reloadToken: Int

    func makeUIView(context: Context) -> WKWebView {
        let webView = makeConfiguredWebView(coordinator: context.coordinator)
        context.coordinator.load(files: files, reloadToken: reloadToken, into: webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.load(files: files, reloadToken: reloadToken, into: webView)
    }

    func makeCoordinator() -> LocalPreviewCoordinator { LocalPreviewCoordinator() }
}

// MARK: - Shared WKWebView setup

private func makeConfiguredWebView(coordinator: WebViewCoordinator) -> WKWebView {
    let configuration = WKWebViewConfiguration()
    configuration.allowsInlineMediaPlayback = true
    configuration.mediaTypesRequiringUserActionForPlayback = []

    let webView = WKWebView(frame: .zero, configuration: configuration)
    webView.isOpaque = false
    webView.backgroundColor = .clear
    webView.scrollView.backgroundColor = .clear
    webView.allowsLinkPreview = false
    webView.scrollView.contentInsetAdjustmentBehavior = .never

    let refresh = UIRefreshControl()
    refresh.addTarget(
        coordinator,
        action: #selector(WebViewCoordinator.handleRefresh(_:)),
        for: .valueChanged
    )
    webView.scrollView.refreshControl = refresh
    coordinator.webView = webView
    return webView
}

class WebViewCoordinator: NSObject {
    weak var webView: WKWebView?

    @objc func handleRefresh(_ sender: UIRefreshControl) {
        webView?.reload()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            sender.endRefreshing()
        }
    }
}

final class LocalPreviewCoordinator: WebViewCoordinator {
    private var lastSignature: String?
    private var previewRoot: URL?

    func load(files: [ProjectFile], reloadToken: Int, into webView: WKWebView) {
        let signature = "\(reloadToken)|\(files.map { "\($0.path):\($0.updatedAt):\($0.content.count)" }.joined(separator: ";"))"
        guard signature != lastSignature else { return }
        lastSignature = signature

        guard let indexURL = writePreviewTree(files: files) else {
            webView.loadHTMLString(
                """
                <html><body style="font-family:-apple-system;background:#0b0c10;color:#eee;padding:24px">
                <h3>No index.html yet</h3>
                <p>The agent hasn't produced an entry file for on-device preview.</p>
                </body></html>
                """,
                baseURL: nil
            )
            return
        }

        webView.loadFileURL(indexURL, allowingReadAccessTo: indexURL.deletingLastPathComponent())
    }

    private func writePreviewTree(files: [ProjectFile]) -> URL? {
        let fm = FileManager.default
        let root = fm.temporaryDirectory
            .appendingPathComponent("pocketforge-local-preview", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)

        do {
            if let previous = previewRoot {
                try? fm.removeItem(at: previous)
            }
            try fm.createDirectory(at: root, withIntermediateDirectories: true)
            previewRoot = root

            for file in files {
                let relative = file.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                guard !relative.isEmpty, !relative.contains("..") else { continue }
                let dest = root.appendingPathComponent(relative)
                try fm.createDirectory(
                    at: dest.deletingLastPathComponent(),
                    withIntermediateDirectories: true
                )
                try Data(file.content.utf8).write(to: dest, options: .atomic)
            }

            let index = root.appendingPathComponent("index.html")
            if fm.fileExists(atPath: index.path) {
                return index
            }
            // Tolerate nested entry points like `app/index.html`.
            if let nested = files.first(where: { $0.path.hasSuffix("index.html") }) {
                let relative = nested.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                return root.appendingPathComponent(relative)
            }
            return nil
        } catch {
            return nil
        }
    }
}
