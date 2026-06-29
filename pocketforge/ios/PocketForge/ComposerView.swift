import SwiftUI

/// New-app composer: a name, a description, and one tap to start the build.
struct ComposerView: View {
    let onCreated: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var prompt = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @FocusState private var promptFocused: Bool

    private static let suggestions: [(title: String, prompt: String)] = [
        ("Todo app", "A beautiful todo app with categories, due dates, swipe to complete, and a progress ring showing how much of today is done."),
        ("Pomodoro timer", "A pomodoro focus timer with a glowing circular countdown, work/break cycles, session history, and satisfying sounds."),
        ("Expense tracker", "An expense tracker with quick-add buttons, category breakdown donut chart, and a monthly spending summary."),
        ("Habit streaks", "A habit tracker with a GitHub-style contribution grid per habit and streak counts that celebrate milestones."),
        ("Recipe box", "A recipe collection app with cards, ingredient checklists, step-by-step cook mode, and search."),
        ("Landing page", "A stunning product landing page for a fictional smart coffee mug, with hero section, features, pricing, and FAQ."),
    ]

    private static let icons = [
        "sparkles", "bolt.fill", "leaf.fill", "flame.fill", "star.fill",
        "heart.fill", "moon.stars.fill", "gamecontroller.fill", "cart.fill",
        "book.fill", "music.note", "paperplane.fill",
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Name")
                                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                                .foregroundStyle(Theme.textSecondary)
                            TextField("My amazing app", text: $name)
                                .font(.system(.body, design: .rounded))
                                .padding(14)
                                .background(Theme.surface)
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            Text("What should it do?")
                                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                                .foregroundStyle(Theme.textSecondary)
                            TextEditor(text: $prompt)
                                .font(.system(.body, design: .rounded))
                                .focused($promptFocused)
                                .scrollContentBackground(.hidden)
                                .padding(10)
                                .frame(minHeight: 150)
                                .background(Theme.surface)
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                .overlay(alignment: .topLeading) {
                                    if prompt.isEmpty {
                                        Text("Describe the app you want — features, vibe, anything…")
                                            .font(.system(.body, design: .rounded))
                                            .foregroundStyle(Theme.textSecondary.opacity(0.6))
                                            .padding(.top, 18)
                                            .padding(.leading, 15)
                                            .allowsHitTesting(false)
                                    }
                                }
                        }

                        VStack(alignment: .leading, spacing: 10) {
                            Text("Need a spark?")
                                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                                .foregroundStyle(Theme.textSecondary)
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 10) {
                                    ForEach(Self.suggestions, id: \.title) { suggestion in
                                        Button {
                                            withAnimation(.snappy) {
                                                if name.isEmpty { name = suggestion.title }
                                                prompt = suggestion.prompt
                                            }
                                        } label: {
                                            Text(suggestion.title)
                                                .font(.system(.subheadline, design: .rounded).weight(.medium))
                                                .foregroundStyle(Theme.textPrimary)
                                                .padding(.horizontal, 14)
                                                .padding(.vertical, 9)
                                                .background(Theme.surfaceRaised)
                                                .clipShape(Capsule())
                                                .overlay(Capsule().strokeBorder(Theme.border, lineWidth: 1))
                                        }
                                    }
                                }
                            }
                        }

                        if let errorMessage {
                            Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                                .font(.system(.subheadline, design: .rounded))
                                .foregroundStyle(Theme.danger)
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("New App")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Theme.textSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: submit) {
                        if isSubmitting {
                            ProgressView().tint(Theme.accent)
                        } else {
                            Label("Build", systemImage: "hammer.fill")
                                .font(.system(.body, design: .rounded).weight(.bold))
                                .foregroundStyle(canSubmit ? Theme.accent : Theme.textSecondary)
                        }
                    }
                    .disabled(!canSubmit || isSubmitting)
                }
            }
            .onAppear { promptFocused = true }
        }
        .preferredColorScheme(.dark)
    }

    private var canSubmit: Bool {
        !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func submit() {
        let trimmedPrompt = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        let projectName = name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? String(trimmedPrompt.prefix(28))
            : name.trimmingCharacters(in: .whitespacesAndNewlines)
        let icon = Self.icons.randomElement() ?? "sparkles"

        isSubmitting = true
        errorMessage = nil
        Task {
            do {
                let projectId = try await ConvexService.shared.createProject(
                    name: projectName,
                    prompt: trimmedPrompt,
                    icon: icon
                )
                // Fire the build and let the live subscriptions stream
                // progress into the workspace we're about to open.
                Task.detached {
                    try? await ConvexService.shared.build(projectId: projectId, prompt: trimmedPrompt)
                }
                dismiss()
                onCreated(projectId)
            } catch {
                errorMessage = "Could not create the project. Check your Convex URL in AppConfig.swift. (\(error.localizedDescription))"
                isSubmitting = false
            }
        }
    }
}
