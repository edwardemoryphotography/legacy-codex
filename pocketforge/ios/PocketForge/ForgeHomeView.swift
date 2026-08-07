import SwiftUI

/// Replit/Lovable-style forge homepage — brand + one prompt, first.
struct ForgeHomeView: View {
    let store: PocketForgeStore

    @StateObject private var service = ConvexService.shared
    @State private var prompt = ""
    @State private var selectedKind: ForgeKind = .website
    @State private var selectedProvider: ModelProvider = .anthropic
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var path = NavigationPath()
    @State private var appear = false
    @FocusState private var promptFocused: Bool

    private let examples: [(title: String, prompt: String)] = [
        ("B2B project hub", "A polished B2B project management app with kanban boards, client portals, and weekly status digests."),
        ("Freelance portal", "A freelance client portal with proposals, invoices, file sharing, and a calm dark dashboard."),
        ("AI sales desk", "An AI sales assistant that drafts outreach, tracks pipeline stages, and logs follow-ups."),
        ("Habit studio", "A habit tracker with streak heatmaps, gentle reminders, and celebration moments."),
    ]

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                ForgeStageBackground()

                ScrollView {
                    VStack(spacing: 0) {
                        hero
                            .padding(.top, 28)
                            .padding(.horizontal, 22)

                        if !service.projects.isEmpty {
                            recentApps
                                .padding(.top, 36)
                                .padding(.horizontal, 22)
                                .padding(.bottom, 40)
                        } else {
                            Color.clear.frame(height: 48)
                        }
                    }
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Text("PocketForge")
                        .font(Theme.displayFont(18, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)
                        .opacity(appear ? 1 : 0)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        PocketForgeSettingsView(store: store)
                    } label: {
                        Image(systemName: "gearshape")
                            .foregroundStyle(Theme.textSecondary)
                    }
                    .accessibilityLabel("Settings")
                }
            }
            .navigationDestination(for: String.self) { projectId in
                WorkspaceView(projectId: projectId)
                    .id(projectId)
            }
            .onAppear {
                withAnimation(.easeOut(duration: 0.7)) { appear = true }
            }
        }
    }

    // MARK: Hero — one composition: brand, headline, prompt, CTA

    private var hero: some View {
        VStack(spacing: 22) {
            VStack(spacing: 12) {
                Text("What will you forge?")
                    .font(Theme.displayFont(appear ? 40 : 36, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.8)
                    .opacity(appear ? 1 : 0)
                    .offset(y: appear ? 0 : 12)

                Text("Turn ideas into live apps in minutes — from your phone.")
                    .font(Theme.uiFont(.body, weight: .medium))
                    .foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.center)
                    .opacity(appear ? 1 : 0)
                    .offset(y: appear ? 0 : 10)
            }
            .padding(.top, 8)

            kindChips
                .opacity(appear ? 1 : 0)

            providerChips
                .opacity(appear ? 1 : 0)

            promptComposer
                .opacity(appear ? 1 : 0)
                .offset(y: appear ? 0 : 16)

            if let errorMessage {
                Text(errorMessage)
                    .font(Theme.uiFont(.footnote))
                    .foregroundStyle(Theme.danger)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            examplePrompts
                .opacity(appear ? 1 : 0)
        }
    }

    private var kindChips: some View {
        chipRow(
            title: nil,
            items: ForgeKind.allCases.map { ($0.id, $0.label) },
            selected: selectedKind.id
        ) { id in
            if let kind = ForgeKind(rawValue: id) {
                withAnimation(.snappy) { selectedKind = kind }
            }
        }
    }

    private var providerChips: some View {
        chipRow(
            title: "Model",
            items: ModelProvider.allCases.map { ($0.id, $0.label) },
            selected: selectedProvider.id
        ) { id in
            if let provider = ModelProvider(rawValue: id) {
                withAnimation(.snappy) { selectedProvider = provider }
            }
        }
    }

    private func chipRow(
        title: String?,
        items: [(id: String, label: String)],
        selected: String,
        onSelect: @escaping (String) -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title {
                Text(title)
                    .font(Theme.uiFont(.caption2, weight: .bold))
                    .foregroundStyle(Theme.textSecondary)
                    .padding(.leading, 4)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(items, id: \.id) { item in
                        let isOn = item.id == selected
                        Button {
                            onSelect(item.id)
                        } label: {
                            Text(item.label)
                                .font(Theme.uiFont(.subheadline, weight: .semibold))
                                .foregroundStyle(isOn ? Theme.background : Theme.textPrimary)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 9)
                                .background(
                                    Capsule().fill(isOn ? Theme.accent : Theme.surfaceRaised)
                                )
                                .overlay(
                                    Capsule().strokeBorder(
                                        isOn ? Color.clear : Theme.border,
                                        lineWidth: 1
                                    )
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 2)
            }
        }
    }

    private var promptComposer: some View {
        VStack(alignment: .leading, spacing: 14) {
            ZStack(alignment: .topLeading) {
                TextEditor(text: $prompt)
                    .font(Theme.uiFont(.body))
                    .foregroundStyle(Theme.textPrimary)
                    .focused($promptFocused)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 110, maxHeight: 160)

                if prompt.isEmpty {
                    Text(selectedKind.placeholder)
                        .font(Theme.uiFont(.body))
                        .foregroundStyle(Theme.textSecondary.opacity(0.55))
                        .padding(.top, 8)
                        .padding(.leading, 5)
                        .allowsHitTesting(false)
                }
            }

            HStack {
                Text("\(selectedProvider.label) · live sandbox")
                    .font(Theme.uiFont(.caption2, weight: .semibold))
                    .foregroundStyle(Theme.textSecondary)

                Spacer()

                Button(action: submit) {
                    HStack(spacing: 8) {
                        if isSubmitting {
                            ProgressView().tint(Theme.background).controlSize(.small)
                        }
                        Text(isSubmitting ? "Forging…" : "Start")
                            .font(Theme.uiFont(.body, weight: .bold))
                        Image(systemName: "arrow.up")
                            .font(.system(size: 13, weight: .bold))
                    }
                    .foregroundStyle(canSubmit ? Theme.background : Theme.textSecondary)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                    .background {
                        if canSubmit {
                            Capsule().fill(Theme.heroGradient)
                        } else {
                            Capsule().fill(Theme.surfaceRaised)
                        }
                    }
                    .shadow(color: canSubmit ? Theme.accent.opacity(0.45) : .clear, radius: 16, y: 6)
                }
                .disabled(!canSubmit || isSubmitting)
                .accessibilityLabel("Start building")
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Theme.surface.opacity(0.92))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(
                    LinearGradient(
                        colors: [Theme.accent.opacity(0.55), Theme.border, Theme.accentGlow.opacity(0.25)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1.2
                )
        )
        .shadow(color: Theme.accent.opacity(0.12), radius: 28, y: 12)
    }

    private var examplePrompts: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Try an example")
                .font(Theme.uiFont(.caption, weight: .semibold))
                .foregroundStyle(Theme.textSecondary)
                .padding(.leading, 4)

            VStack(spacing: 8) {
                ForEach(examples, id: \.title) { example in
                    Button {
                        withAnimation(.snappy) {
                            prompt = example.prompt
                            promptFocused = true
                        }
                    } label: {
                        HStack {
                            Text(example.title)
                                .font(Theme.uiFont(.subheadline, weight: .medium))
                                .foregroundStyle(Theme.textPrimary)
                            Spacer()
                            Image(systemName: "arrow.up.right")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Theme.accent)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 13)
                        .background(Theme.surface.opacity(0.65))
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .strokeBorder(Theme.border, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.top, 8)
    }

    private var recentApps: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Your apps")
                .font(Theme.displayFont(22, weight: .bold))
                .foregroundStyle(Theme.textPrimary)

            LazyVStack(spacing: 10) {
                ForEach(service.projects) { project in
                    Button {
                        path.append(project.id)
                    } label: {
                        ProjectRow(project: project)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var canSubmit: Bool {
        !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func submit() {
        let trimmed = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let name = String(trimmed.prefix(32))
        isSubmitting = true
        errorMessage = nil
        Task {
            do {
                let projectId = try await ConvexService.shared.createProject(
                    name: name,
                    prompt: "\(selectedKind.buildPrefix)\(trimmed)",
                    icon: selectedKind.icon,
                    provider: selectedProvider.rawValue
                )
                Task.detached {
                    try? await ConvexService.shared.build(projectId: projectId, prompt: trimmed)
                }
                prompt = ""
                isSubmitting = false
                path.append(projectId)
            } catch {
                errorMessage = "Couldn’t start the forge. Try again in a moment."
                isSubmitting = false
            }
        }
    }
}

enum ForgeKind: String, CaseIterable, Identifiable {
    case website, mobile, design, game, data

    var id: String { rawValue }

    var label: String {
        switch self {
        case .website: "Website"
        case .mobile: "Mobile"
        case .design: "Design"
        case .game: "Game"
        case .data: "Data"
        }
    }

    var icon: String {
        switch self {
        case .website: "globe"
        case .mobile: "iphone"
        case .design: "paintbrush.fill"
        case .game: "gamecontroller.fill"
        case .data: "chart.bar.fill"
        }
    }

    var placeholder: String {
        switch self {
        case .website: "Describe a site — landing page, dashboard, storefront…"
        case .mobile: "Describe a mobile-first web app experience…"
        case .design: "Describe a visual concept or marketing page…"
        case .game: "Describe a lightweight browser game…"
        case .data: "Describe a dashboard or data visualization…"
        }
    }

    var buildPrefix: String {
        switch self {
        case .website: "Build a beautiful website: "
        case .mobile: "Build a mobile-first web app: "
        case .design: "Build a design-forward page: "
        case .game: "Build a playful browser game: "
        case .data: "Build a data visualization app: "
        }
    }
}

private struct ProjectRow: View {
    let project: Project

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: project.symbolName)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Theme.accent)
                .frame(width: 44, height: 44)
                .background(Theme.accentSoft)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text(project.name)
                    .font(Theme.uiFont(.body, weight: .semibold))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text(project.providerLabel)
                        .font(Theme.uiFont(.caption2, weight: .semibold))
                        .foregroundStyle(Theme.accent)
                    Text("·")
                        .font(Theme.uiFont(.caption2))
                        .foregroundStyle(Theme.textSecondary.opacity(0.5))
                    Text(project.prompt)
                        .font(Theme.uiFont(.caption))
                        .foregroundStyle(Theme.textSecondary)
                        .lineLimit(1)
                }
            }

            Spacer()
            StatusPill(project: project)
        }
        .padding(14)
        .background(Theme.surface.opacity(0.75))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Theme.border, lineWidth: 1)
        )
    }
}

#Preview {
    ForgeHomeView(store: PocketForgeStore())
        .preferredColorScheme(.dark)
}
