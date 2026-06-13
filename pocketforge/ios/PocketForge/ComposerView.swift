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

    // Suggestions shown as chips. Starts as a hand-picked set; the dice button
    // replaces them with fresh, personalized ideas from the backend.
    @State private var ideas: [AppIdea] = ComposerView.starterIdeas
    @State private var isRolling = false
    @State private var rollCount = 0

    private static let starterIdeas: [AppIdea] = [
        AppIdea(title: "Todo app", prompt: "A beautiful todo app with categories, due dates, swipe to complete, and a progress ring showing how much of today is done.", icon: "checklist"),
        AppIdea(title: "Pomodoro timer", prompt: "A pomodoro focus timer with a glowing circular countdown, work/break cycles, session history, and satisfying sounds.", icon: "timer"),
        AppIdea(title: "Expense tracker", prompt: "An expense tracker with quick-add buttons, category breakdown donut chart, and a monthly spending summary.", icon: "dollarsign.circle.fill"),
        AppIdea(title: "Habit streaks", prompt: "A habit tracker with a GitHub-style contribution grid per habit and streak counts that celebrate milestones.", icon: "flame.fill"),
        AppIdea(title: "Recipe box", prompt: "A recipe collection app with cards, ingredient checklists, step-by-step cook mode, and search.", icon: "fork.knife"),
        AppIdea(title: "Landing page", prompt: "A stunning product landing page for a fictional smart coffee mug, with hero section, features, pricing, and FAQ.", icon: "globe"),
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
                            HStack(spacing: 8) {
                                Text(isRolling ? "Rolling up ideas…" : "Need a spark?")
                                    .font(.system(.subheadline, design: .rounded).weight(.semibold))
                                    .foregroundStyle(Theme.textSecondary)
                                    .animation(.snappy, value: isRolling)
                                Spacer()
                                Button(action: roll) {
                                    Group {
                                        if isRolling {
                                            ProgressView().controlSize(.small).tint(Theme.accent)
                                        } else {
                                            Image(systemName: "die.face.5.fill")
                                                .font(.system(size: 18, weight: .semibold))
                                                .foregroundStyle(Theme.accent)
                                                .symbolEffect(.bounce, value: rollCount)
                                        }
                                    }
                                    .frame(width: 36, height: 36)
                                    .background(Theme.surfaceRaised)
                                    .clipShape(Circle())
                                    .overlay(Circle().strokeBorder(Theme.border, lineWidth: 1))
                                }
                                .disabled(isRolling)
                                .accessibilityLabel("Roll the dice for new ideas")
                            }
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 10) {
                                    ForEach(ideas) { idea in
                                        Button {
                                            withAnimation(.snappy) {
                                                if name.isEmpty { name = idea.title }
                                                prompt = idea.prompt
                                            }
                                        } label: {
                                            HStack(spacing: 6) {
                                                Image(systemName: idea.icon)
                                                    .font(.system(size: 13, weight: .semibold))
                                                    .foregroundStyle(Theme.accent)
                                                Text(idea.title)
                                                    .font(.system(.subheadline, design: .rounded).weight(.medium))
                                                    .foregroundStyle(Theme.textPrimary)
                                            }
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

    /// Roll the dice: fetch fresh ideas tailored to the user's projects.
    private func roll() {
        isRolling = true
        rollCount += 1
        errorMessage = nil
        Task {
            do {
                let fresh = try await ConvexService.shared.suggestIdeas()
                await MainActor.run {
                    withAnimation(.snappy) { ideas = fresh }
                    isRolling = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Couldn't roll up ideas just now — give it another try."
                    isRolling = false
                }
            }
        }
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
