import SwiftUI

struct HomeView: View {
    @StateObject private var service = ConvexService.shared
    @State private var showComposer = false
    @State private var showProfile = false
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                Theme.background.ignoresSafeArea()

                if service.projects.isEmpty {
                    emptyState
                } else {
                    ScrollView {
                        LazyVStack(spacing: 14) {
                            ForEach(service.projects) { project in
                                Button {
                                    path.append(project.id)
                                } label: {
                                    ProjectCard(project: project)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 18)
                        .padding(.vertical, 12)
                    }
                }
            }
            .navigationTitle("Your Apps")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showProfile = true
                    } label: {
                        Image(systemName: "person.crop.circle")
                            .font(.title2)
                            .foregroundStyle(Theme.accent)
                    }
                    .accessibilityLabel("Edit your profile")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showComposer = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title2)
                            .foregroundStyle(Theme.accent)
                    }
                }
            }
            .navigationDestination(for: String.self) { projectId in
                WorkspaceView(projectId: projectId)
                    .id(projectId)
            }
            .sheet(isPresented: $showComposer) {
                ComposerView { projectId in
                    path.append(projectId)
                }
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
            }
            .sheet(isPresented: $showProfile) {
                ProfileSheet()
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 18) {
            Image(systemName: "hammer.circle.fill")
                .font(.system(size: 72))
                .foregroundStyle(Theme.heroGradient)
            Text("Nothing forged yet")
                .font(.system(.title2, design: .rounded).weight(.bold))
                .foregroundStyle(Theme.textPrimary)
            Text("Describe an app and watch it come to life in a live cloud sandbox.")
                .font(.system(.subheadline, design: .rounded))
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 48)
            Button {
                showComposer = true
            } label: {
                Label("Build your first app", systemImage: "sparkles")
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 22)
                    .padding(.vertical, 13)
                    .background(Theme.heroGradient)
                    .clipShape(Capsule())
            }
            .padding(.top, 6)
        }
    }
}

struct ProjectCard: View {
    let project: Project

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: project.symbolName)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(Theme.accent)
                .frame(width: 50, height: 50)
                .background(Theme.accentSoft)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

            VStack(alignment: .leading, spacing: 5) {
                Text(project.name)
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
                Text(project.prompt)
                    .font(.system(.caption, design: .rounded))
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(2)
            }

            Spacer()

            StatusPill(project: project)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle()
    }
}

/// Where the user's self-description lives. Read by the dice idea generator
/// so suggestions reflect who they are, not just what they've built.
enum ProfileStore {
    static let key = "pf_userProfile"
}

/// Lightweight editor for the "who I am / what I'm working on" profile that
/// personalizes rolled ideas.
struct ProfileSheet: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage(ProfileStore.key) private var profile = ""
    @State private var draft = ""
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Tell the dice who you are")
                            .font(.system(.title3, design: .rounded).weight(.bold))
                            .foregroundStyle(Theme.textPrimary)
                        Text("A sentence or two about you and what you're working on. The “roll the dice” idea generator uses this to tailor suggestions.")
                            .font(.system(.subheadline, design: .rounded))
                            .foregroundStyle(Theme.textSecondary)

                        TextEditor(text: $draft)
                            .font(.system(.body, design: .rounded))
                            .focused($focused)
                            .scrollContentBackground(.hidden)
                            .padding(10)
                            .frame(minHeight: 160)
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .overlay(alignment: .topLeading) {
                                if draft.isEmpty {
                                    Text("e.g. I'm a wedding photographer building tools to run my business and stay creative.")
                                        .font(.system(.body, design: .rounded))
                                        .foregroundStyle(Theme.textSecondary.opacity(0.6))
                                        .padding(.top, 18)
                                        .padding(.leading, 15)
                                        .allowsHitTesting(false)
                                }
                            }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Theme.textSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        profile = draft.trimmingCharacters(in: .whitespacesAndNewlines)
                        dismiss()
                    }
                    .font(.system(.body, design: .rounded).weight(.bold))
                    .foregroundStyle(Theme.accent)
                }
            }
            .onAppear {
                draft = profile
                focused = true
            }
        }
        .preferredColorScheme(.dark)
    }
}

struct StatusPill: View {
    let project: Project

    var body: some View {
        HStack(spacing: 5) {
            if project.isBuilding {
                ProgressView()
                    .controlSize(.mini)
                    .tint(Theme.accent)
            } else {
                Circle()
                    .fill(color)
                    .frame(width: 7, height: 7)
            }
            Text(label)
                .font(.system(.caption2, design: .rounded).weight(.semibold))
                .foregroundStyle(color)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(color.opacity(0.13))
        .clipShape(Capsule())
    }

    private var color: Color {
        switch project.status {
        case "live": return Theme.success
        case "building": return Theme.accent
        case "error": return Theme.danger
        default: return Theme.textSecondary
        }
    }

    private var label: String {
        switch project.status {
        case "live": return "Live"
        case "building": return "Building"
        case "error": return "Error"
        default: return "Draft"
        }
    }
}
