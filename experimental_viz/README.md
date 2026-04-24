# SpineViz AI 🩻🔬

**SpineViz AI** is a premium, interactive web application that provides MRI-guided spinal diagnosis and surgical reference. It integrates advanced **Google Gemini AI** for automated image analysis alongside an interactive, cinematic 3D spinal viewer.

This tool is designed for educational and demonstration purposes, offering a sleek, user-friendly interface to explore different spinal regions (Cervical, Thoracic, Lumbar, Sacral) and automatically pinpoint affected areas based on MRI uploads.

## ✨ Features

- 🤖 **Gemini AI Integration:** Upload JPEG, PNG, or DICOM screenshots of an MRI to receive an automated AI diagnosis, including confidence levels and affected spinal levels.
- 🦴 **Interactive 3D Spine Viewer:** Explorable 3D model of the human spinal column, highlighting regions dynamically. (Powered by the Sketchfab Viewer API / Three.js).
- 🎨 **Premium UI/UX:** Cinematic animations, sleek dark mode aesthetics with color-coded region mapping, and an immersive layout.
- 📚 **Surgical Reference:** Detailed overviews and surgical options automatically appear for the chosen or AI-detected spinal region.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- A [Google Gemini API Key](https://aistudio.google.com/) for MRI analysis.

### Installation

1. **Navigate to the project directory:**
   ```bash
   cd Nakshatra
   ```

2. **Install the dependencies:**
   ```bash
   npm install
   ```

3. **Start the Vite development server:**
   ```bash
   npm run dev
   ```

4. **Open the application:**
   Navigate to the local URL (usually `http://localhost:5173`) in your browser.

## 💡 How to Use
1. Pass your **Gemini API Key** into the input field at the top right of the application.
2. **Upload an MRI scan** using the drag-and-drop zone on the left panel.
3. Click **"Analyse with Gemini AI"**. The AI will process the scan and identify the affected region (e.g., L4-L5 Herniation).
4. Watch the 3D model automatically direct your attention and highlight the affected area.
5. Manually explore other regions by clicking the respective **Spinal Regions** buttons on the left panel for detailed surgical references.

## 🛠️ Built With

- **Framework:** React / Vite (or plain HTML/JS prototype)
- **3D Visualization:** Sketchfab Viewer API & Three.js ecosystem (`@react-three/fiber`, `@react-three/drei`)
- **AI Backend:** Google Gemini API
- **Animations & Styling:** Framer Motion, Vanilla CSS / Tailwind (depending on the specific entry point)

## ⚠️ Disclaimer
*For educational and demonstration use only. This tool is NOT intended for actual clinical use, professional medical advice, diagnosis, or treatment.*
