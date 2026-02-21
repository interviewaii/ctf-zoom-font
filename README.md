# Interview Assistant AI

A powerful, discreet AI-powered assistant designed to help you excel in interviews, exams, and professional meetings.

## 🚀 Key Features

- **Real-time Assistance**: Get instant answers tailored to your context.
- **Context-Aware**: Uses your resume and job description to personalize answers.
- **Strict Formatting**: Delivers concise, ready-to-speak responses in bullet points (6-8 points per answer).
- **Multiple Profiles**: optimized modes for:
  - **Interview**: Focuses on professional experience and technical depth.
  - **Exam**: Provides direct answers with brief justifications.
  - **Sales/Negotiation**: Strategic, persuasive responses.
  - **Meeting/Presentation**: Clear, actionable points.

## ⚙️ Configuration

### 1. Resume / Job Context (NEW)
Located in the **Profile** section of Settings.
- **Purpose**: This is the AI's "Knowledge Base".
- **What to put here**: Paste your **Resume**, the **Job Description**, or key project details.
- **Behavior**: The AI will *always* know this information and use it to tailor answers (e.g., "Tell me about a time you used React" will use *your* specific project details).

### 2. Custom AI Instructions
Located below the Resume Context.
- **Purpose**: These are **commands** for how the AI should behave.
- **What to put here**: "Be concise", "Act like a Senior Engineer", "Don't use code unless asked".
- **Behavior**: The AI treats these as strict rules to follow for every response.

## 🎯 Response Format

The AI is strictly configured to output:
- **Bullet Points ONLY**: No paragraphs, no conversational filler.
- **6-8 Points**: Every answer is broken down into 6-8 distinct factual points.
- **Direct & Factual**: Starts immediately with a dash (-).

### Example Output:
> - React is a JavaScript library for building user interfaces.
> - It was developed by Facebook and is widely used for single-page applications.
> - It uses a Virtual DOM to optimize rendering performance.
> - Components are the building blocks of React applications.
> - It follows a unidirectional data flow.
> - Hooks allow functional components to manage state and side effects.

## 🛠️ Usage

1.  **Launch the App**: `npm start`
2.  **Configure**: Go to Settings -> Profile and paste your Resume.
3.  **Start Session**: Click "Start" on the main view.
4.  **Get Answers**: The AI detects questions from your screen/audio and provides instant bullet-point answers.

## ⚠️ Troubleshooting

- **"I don't see changes"**: If you update settings or instructions, please **Restart the Application** to ensure the new configuration is loaded into the AI session.
