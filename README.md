# GitStory 🎬

A timelapse video creator for GitHub repositories. Input a repo, select branches, and watch the evolution of your app through screenshots and video.

## Features

- 📦 **GitHub Repository Input**: Clone any public GitHub repository
- 🌿 **Branch Selection**: Choose multiple branches to include in your timelapse
- 📸 **Puppeteer Screenshots**: Automated browser screenshots of running applications
- 📊 **Real-time Progress**: Live updates via Server-Sent Events (SSE)
- 🎥 **Timelapse Video**: Generate MP4 videos showing app evolution across branches
- ⚙️ **Environment Variables**: Automatic .env.example detection and configuration
- 💾 **Video Download**: Download your generated timelapse videos

## How It Works

1. **Input Repository**: Enter a GitHub repository URL
2. **Select Branches**: Choose which branches to include (main, develop, staging, etc.)
3. **Configure**: Set install/run commands and port number
4. **Process**: GitStory will:
   - Clone the repository
   - For each branch:
     - Checkout the branch
     - Install dependencies
     - Run the application
     - Take a screenshot with Puppeteer
   - Create a timelapse video from all screenshots
5. **Download**: Get your timelapse video showing the evolution!

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Git Operations**: simple-git
- **Screenshots**: Puppeteer (headless browser)
- **Video Creation**: FFmpeg (via fluent-ffmpeg)
- **Validation**: Zod
- **Real-time Updates**: Server-Sent Events (SSE)

## Prerequisites

- Node.js 18+
- npm, yarn, or pnpm
- FFmpeg installed on your system
- Chrome/Chromium (for Puppeteer)

### Install FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get install ffmpeg
```

**Windows:**
Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH

## Installation

1. Clone this repository:
```bash
git clone https://github.com/filiksyos/gitstory.git
cd gitstory
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
# or
yarn install
```

3. Run the development server:
```bash
npm run dev
# or
pnpm dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Basic Workflow

1. **Enter Repository URL**: `https://github.com/username/repository`

2. **Add Branches**: Click buttons to add common branches (main, develop, staging) or add custom ones

3. **Select Branches**: Check the boxes for branches you want to include

4. **Configure Commands**:
   - Install Command: `npm install` (or `yarn install`, `pnpm install`)
   - Run Command: `npm run dev` (or your app's start command)
   - Port: The port your app runs on (default: 3000)

5. **Optional - Environment Variables**:
   - Click "Fetch Env" to load variables from `.env.example`
   - Fill in required values

6. **Create Timelapse**: Click the button and watch the progress!

7. **Download**: Once complete, download your timelapse video

### Example Repositories to Try

- Next.js App: `https://github.com/vercel/next.js`
- React App: `https://github.com/facebook/create-react-app`
- Your own projects!

## Project Structure

```
gitstory/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── process/          # Main processing endpoint
│   │   │   │   └── route.ts
│   │   │   ├── status/           # SSE status updates
│   │   │   │   └── [jobId]/
│   │   │   │       └── route.ts
│   │   │   ├── fetch-env/        # Fetch .env.example
│   │   │   │   └── route.ts
│   │   │   └── download/         # Download video
│   │   │       └── [jobId]/
│   │   │           └── route.ts
│   │   ├── page.tsx              # Main UI
│   │   ├── layout.tsx
│   │   └── globals.css
│   └── lib/
│       ├── types.ts              # TypeScript types
│       ├── job-manager.ts        # Job state management
│       ├── git-utils.ts          # Git operations
│       ├── screenshot-utils.ts   # Puppeteer screenshots
│       ├── video-utils.ts        # FFmpeg video creation
│       └── env-utils.ts          # Environment variables
├── temp-repos/                   # Temporary cloned repos
├── screenshots/                  # Captured screenshots
├── videos/                       # Generated videos
├── package.json
├── tsconfig.json
└── README.md
```

## How It Works Internally

### 1. Job Creation
- User submits form → Creates job with unique ID
- Returns job ID immediately
- Processing happens asynchronously

### 2. Repository Cloning
- Uses `simple-git` to clone repository to `temp-repos/[jobId]/`
- Fetches all remote branches

### 3. Branch Processing (for each selected branch)
- Checkout branch with `git checkout`
- Install dependencies with specified command
- Start application in background
- Wait for app to respond at specified port
- Launch Puppeteer headless browser
- Navigate to `http://localhost:[port]`
- Take screenshot (1280x720)
- Kill application process

### 4. Video Creation
- Collect all screenshots
- Use FFmpeg to create timelapse:
  - Each frame shown for 1 second (1 fps)
  - H.264 codec, MP4 format
  - Output to `videos/[jobId].mp4`

### 5. Real-time Updates
- SSE connection streams job status every 500ms
- Progress bar updates with current step
- Shows branch progress (e.g., "2 of 5 branches")

### 6. Cleanup
- Temporary repository deleted after processing
- Jobs auto-cleanup after 1 hour

## API Endpoints

### POST /api/process
Start processing a repository.

**Request:**
```json
{
  "repositoryUrl": "https://github.com/user/repo",
  "branches": ["main", "develop"],
  "installCommand": "npm install",
  "runCommand": "npm run dev",
  "port": 3000,
  "envVars": { "API_KEY": "value" }
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "job_1234567890_abc123"
}
```

### GET /api/status/[jobId]
Server-Sent Events stream for job updates.

**Response Stream:**
```
data: {"id":"job_123","status":"cloning","progress":10,"currentStep":"Cloning repository..."}

data: {"id":"job_123","status":"processing","progress":40,"currentStep":"Processing branch 1/2: main"}

data: {"id":"job_123","status":"complete","progress":100,"result":{"videoUrl":"/api/download/job_123"}}
```

### POST /api/fetch-env
Fetch environment variables from .env.example.

**Request:**
```json
{
  "repositoryUrl": "https://github.com/user/repo"
}
```

**Response:**
```json
{
  "success": true,
  "envVars": ["API_KEY", "DATABASE_URL"]
}
```

### GET /api/download/[jobId]
Download the generated video file.

**Response:** MP4 video file

## Configuration

No environment variables required! GitStory works out of the box.

Optional: If you want to configure FFmpeg path or other settings, you can modify the utility files in `src/lib/`.

## Limitations

- Only public GitHub repositories supported
- Applications must run on localhost
- Each branch must use the same install/run commands
- Video quality: 1280x720, 1 fps
- Jobs auto-cleanup after 1 hour
- Temporary files stored on disk during processing

## Troubleshooting

### FFmpeg not found
Make sure FFmpeg is installed and in your PATH:
```bash
ffmpeg -version
```

### Puppeteer installation issues
```bash
# Install Chrome dependencies on Linux
sudo apt-get install -y libgbm-dev libnss3 libatk-bridge2.0-0 libgtk-3-0
```

### Application doesn't start
- Check if the port is already in use
- Verify install/run commands are correct
- Make sure the repository has a valid package.json

### Screenshots are blank
- Application might need more time to start (increase timeout)
- Check if the app runs on the specified port
- Some apps require specific environment variables

## Future Enhancements

- Support for private repositories (GitHub token)
- Custom video quality and FPS settings
- Git commit-based timelapse (not just branches)
- Screenshot annotations (branch name, date)
- Multiple video formats (GIF, WebM)
- Parallel branch processing
- Database storage for job history

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT

## Acknowledgments

Inspired by:
- [gitimage](https://github.com/filiksyos/gitimage) - GitHub repository screenshot tool
- [quine-checkcup](https://github.com/PriyanshuPz/quine-checkcup) - Puppeteer screenshot implementation
- [hima.js](https://github.com/rpidanny/hima.js) - FFmpeg timelapse creation

---

Built with ❤️ using Next.js, Puppeteer, and FFmpeg