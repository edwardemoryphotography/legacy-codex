import Combine
import SwiftUI

@MainActor
final class WorkspaceViewModel: ObservableObject {
    @Published var project: Project?
    @Published var messages: [Message] = []
    @Published var files: [ProjectFile] = []

    private var cancellables = Set<AnyCancellable>()

    init(projectId: String) {
        let service = ConvexService.shared
        service.projectPublisher(projectId: projectId)
            .sink { [weak self] in self?.project = $0 }
            .store(in: &cancellables)
        service.messagesPublisher(projectId: projectId)
            .sink { [weak self] in self?.messages = $0 }
            .store(in: &cancellables)
        service.filesPublisher(projectId: projectId)
            .sink { [weak self] in self?.files = $0 }
            .store(in: &cancellables)
    }
}

struct WorkspaceView: View {
    let projectId: String

    enum Tab: String, CaseIterable {
        case preview = "App"
        case agent = "Agent"
        case code = "Code"

        var symbol: String {
            switch self {
            case .preview: return "iphone"
            case .agent: return "wand.and.stars"
            case .code: return "chevron.left.forwardslash.chevron.right"
            }
        }
    }

    @StateObject private var model: WorkspaceViewModel
    @State private var tab: Tab = .preview
    @State private var reloadToken = 0
    @State private var showDeleteConfirm = false
    @Environment(\.dismiss) private var dismiss

    init(projectId: String) {
        self.projectId = projectId
        _model = StateObject(wrappedValue: WorkspaceViewModel(projectId: projectId))
    }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            VStack(spacing: 0) {
                tabBar
                statusBanner

                switch tab {
                case .preview:
                    PreviewTab(project: model.project, reloadToken: reloadToken)
                case .agent:
                    AgentTab(projectId: projectId, model: model)
                case .code:
                    CodeTab(files: model.files)
                }
            }
        }
        .navigationTitle(model.project?.name ?? "App")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    if let url = previewURL {
                        Link(destination: url) {
                            Label("Open in Safari", systemImage: "safari")
                        }
                        ShareLink(item: url) {
                            Label("Share app link", systemImage: "square.and.arrow.up")
                        }
                        Button {
                            reloadToken += 1
                        } label: {
                            Label("Reload preview", systemImage: "arrow.clockwise")
                        }
                    }
                    Button(role: .destructive) {
                        showDeleteConfirm = true
                    } label: {
                        Label("Delete app", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .foregroundStyle(Theme.accent)
                }
            }
        }
        .confirmationDialog(
            "Delete this app and its sandbox?",
            isPresented: $showDeleteConfirm,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                Task {
                    try? await ConvexService.shared.destroy(projectId: projectId)
                    dismiss()
                }
            }
        }
        .task {
            // Sandboxes can go to sleep; make sure this one is serving.
            await ConvexService.shared.wake(projectId: projectId)
        }
        .onChange(of: model.project?.previewUrl) {
            reloadToken += 1
        }
    }

    private var previewURL: URL? {
        guard let raw = model.project?.previewUrl else { return nil }
        return URL(string: raw)
    }

    private var tabBar: some View {
        HStack(spacing: 8) {
            ForEach(Tab.allCases, id: \.self) { item in
                Button {
                    withAnimation(.snappy(duration: 0.25)) { tab = item }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: item.symbol)
                            .font(.system(size: 13, weight: .semibold))
                        Text(item.rawValue)
                            .font(.system(.subheadline, design: .rounded).weight(.semibold))
                    }
                    .foregroundStyle(tab == item ? .white : Theme.textSecondary)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 9)
                    .frame(maxWidth: .infinity)
                    .background(tab == item ? AnyShapeStyle(Theme.heroGradient) : AnyShapeStyle(Color.clear))
                    .clipShape(Capsule())
                }
            }
        }
        .padding(5)
        .background(Theme.surface)
        .clipShape(Capsule())
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    @ViewBuilder
    private var statusBanner: some View {
        if let project = model.project, project.isBuilding {
            HStack(spacing: 10) {
                ProgressView().controlSize(.small).tint(Theme.accent)
                Text(project.statusDetail ?? "Building…")
                    .font(.system(.subheadline, design: .rounded).weight(.medium))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Theme.accentSoft)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .padding(.horizontal, 16)
            .padding(.bottom, 8)
            .transition(.move(edge: .top).combined(with: .opacity))
        } else if let project = model.project, project.isError {
            HStack(spacing: 10) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(Theme.danger)
                Text(project.statusDetail ?? "Something went wrong")
                    .font(.system(.subheadline, design: .rounded).weight(.medium))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(2)
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Theme.danger.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .padding(.horizontal, 16)
            .padding(.bottom, 8)
        }
    }
}

// MARK: - Preview tab

private struct PreviewTab: View {
    let project: Project?
    let reloadToken: Int

    var body: some View {
        Group {
            if let raw = project?.previewUrl, let url = URL(string: raw) {
                WebView(url: url)
                    .id("\(raw)-\(reloadToken)")
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 22, style: .continuous)
                            .strokeBorder(Theme.border, lineWidth: 1)
                    )
                    .padding(.horizontal, 12)
                    .padding(.bottom, 12)
            } else if project?.isBuilding == true {
                placeholder(
                    symbol: "hammer.fill",
                    title: "Forging your app",
                    detail: "Claude is writing the code and the sandbox is warming up. The preview appears here the moment it's live."
                )
            } else if project?.isError == true {
                placeholder(
                    symbol: "exclamationmark.triangle.fill",
                    title: "Build hit a snag",
                    detail: "Open the Agent tab and ask for a fix, or try the build again."
                )
            } else {
                placeholder(
                    symbol: "iphone.gen3",
                    title: "No preview yet",
                    detail: "Once the first build finishes, your app runs right here."
                )
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func placeholder(symbol: String, title: String, detail: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 46))
                .foregroundStyle(Theme.accent)
                .symbolEffect(.pulse, options: .repeating)
            Text(title)
                .font(.system(.title3, design: .rounded).weight(.bold))
                .foregroundStyle(Theme.textPrimary)
            Text(detail)
                .font(.system(.subheadline, design: .rounded))
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 44)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Agent tab

private struct AgentTab: View {
    let projectId: String
    @ObservedObject var model: WorkspaceViewModel
    @State private var draft = ""
    @FocusState private var inputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(model.messages) { message in
                            MessageBubble(message: message)
                                .id(message.id)
                        }
                    }
                    .padding(16)
                }
                .onChange(of: model.messages.count) {
                    if let last = model.messages.last {
                        withAnimation(.snappy) { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }

            HStack(spacing: 10) {
                TextField("Ask for a change…", text: $draft, axis: .vertical)
                    .font(.system(.body, design: .rounded))
                    .lineLimit(1...4)
                    .focused($inputFocused)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 11)
                    .background(Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))

                Button(action: send) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 32))
                        .foregroundStyle(canSend ? Theme.accent : Theme.textSecondary.opacity(0.4))
                }
                .disabled(!canSend)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Theme.background)
        }
    }

    private var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && model.project?.isBuilding != true
    }

    private func send() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        draft = ""
        Task.detached {
            try? await ConvexService.shared.build(projectId: projectId, prompt: text)
        }
    }
}

private struct MessageBubble: View {
    let message: Message

    var body: some View {
        if message.isStatus {
            Text(message.content)
                .font(.system(.caption, design: .rounded))
                .foregroundStyle(Theme.textSecondary)
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)
        } else {
            HStack {
                if message.isUser { Spacer(minLength: 48) }
                Text(message.content)
                    .font(.system(.body, design: .rounded))
                    .foregroundStyle(message.isUser ? .white : Theme.textPrimary)
                    .padding(.horizontal, 15)
                    .padding(.vertical, 11)
                    .background(
                        message.isUser
                            ? AnyShapeStyle(Theme.heroGradient)
                            : AnyShapeStyle(Theme.surface)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                if !message.isUser { Spacer(minLength: 48) }
            }
        }
    }
}

// MARK: - Code tab

private struct CodeTab: View {
    let files: [ProjectFile]

    var body: some View {
        Group {
            if files.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "curlybraces")
                        .font(.system(size: 44))
                        .foregroundStyle(Theme.accent)
                    Text("No code yet")
                        .font(.system(.title3, design: .rounded).weight(.bold))
                        .foregroundStyle(Theme.textPrimary)
                    Text("Source files show up here as the agent writes them.")
                        .font(.system(.subheadline, design: .rounded))
                        .foregroundStyle(Theme.textSecondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(files) { file in
                            NavigationLink {
                                FileDetailView(file: file)
                            } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: file.fileSymbol)
                                        .font(.system(size: 16, weight: .semibold))
                                        .foregroundStyle(Theme.accent)
                                        .frame(width: 36, height: 36)
                                        .background(Theme.accentSoft)
                                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(file.path)
                                            .font(.system(.subheadline, design: .monospaced).weight(.medium))
                                            .foregroundStyle(Theme.textPrimary)
                                        Text("\(file.content.count.formatted()) chars")
                                            .font(.system(.caption2, design: .rounded))
                                            .foregroundStyle(Theme.textSecondary)
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .font(.system(size: 12, weight: .semibold))
                                        .foregroundStyle(Theme.textSecondary)
                                }
                                .padding(13)
                                .cardStyle()
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(16)
                }
            }
        }
    }
}

private struct FileDetailView: View {
    let file: ProjectFile

    var body: some View {
        ScrollView([.vertical, .horizontal]) {
            Text(file.content)
                .font(.system(size: 12, design: .monospaced))
                .foregroundStyle(Theme.textPrimary)
                .textSelection(.enabled)
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.background)
        .navigationTitle(file.path)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                ShareLink(item: file.content) {
                    Image(systemName: "square.and.arrow.up")
                        .foregroundStyle(Theme.accent)
                }
            }
        }
    }
}
