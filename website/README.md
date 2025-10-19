# GPU Price Tracker Website

Static website for visualizing GPU pricing data.

## Features

- 📊 Interactive price trend charts (7-day view)
- 💰 Real-time best deals by configuration
- 📈 Provider comparison tables
- 🎨 Dark theme, responsive design
- ⚡ Fast, static site (no backend needed)

## Local Development

```bash
# Start local server
cd website
python3 -m http.server 8000

# Open browser to http://localhost:8000
```

## File Structure

```
website/
├── index.html      # Main dashboard
├── styles.css      # Styling
├── app.js          # Data loading and visualization
└── README.md       # This file
```

## Data Sources

The website reads JSONL data from:
- `../data/summary/*.jsonl` - Price statistics, trends, and best deals per configuration

## GitHub Pages Deployment

### Option 1: Deploy from root (website/ folder)

1. Go to repository Settings → Pages
2. Source: Deploy from a branch
3. Branch: `main` → `/website` folder
4. Save

Your site will be at: `https://USERNAME.github.io/gpu-price-tracker/`

### Option 2: Deploy from docs/ folder

```bash
# Move website to docs/
mv website docs

# Update GitHub Pages settings to use /docs folder
```

### Option 3: Separate gh-pages branch

```bash
# Create gh-pages branch with only website files
git checkout --orphan gh-pages
git rm -rf .
cp -r website/* .
git add .
git commit -m "Deploy website"
git push origin gh-pages

# Set GitHub Pages to use gh-pages branch
```

## Configuration

Update `app.js` to adjust the data path:

```javascript
// For GitHub Pages from /website folder:
const DATA_BASE_URL = '../data';

// For gh-pages branch (website at root):
const DATA_BASE_URL = './data';
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## Dependencies

- [Chart.js](https://www.chartjs.org/) v4.4.0 (loaded from CDN)
- Pure HTML/CSS/JS (no build process required)
