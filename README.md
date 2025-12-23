# RebelX Headquarters (ERP System)

A high-performance, minimalist ERP application built with Next.js 15+ (App Router), Tailwind CSS 4, and Framer Motion.

## Core Features
- **Modern Minimalist UI**: Clean, light-themed design for low cognitive load and high speed.
- **Sticky Mega Menu Header**:
    - **10% Logo Area**
    - **60% Navigation Area** (Mega Menu on Desktop)
    - **30% Dynamic Actions** (Context-aware buttons based on route)
- **Mobile Optimized**: Seamless transition to a burger menu on mobile devices.
- **Dynamic KPI Dashboard**: User-specific metrics with real-time aesthetic.
- **Serverless Ready**: Optimized for Vercel deployment.

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Language**: TypeScript

## Project Structure
- `src/app`: App Router pages and layouts.
- `src/components/Header`: All header-related components (MegaMenu, MobileMenu, DynamicActions).
- `src/components/Dashboard`: Dashboard-specific UI components.
- `src/constants`: Navigation schema and global constants.
- `src/hooks`: Global hooks like context-aware header actions.
- `src/lib`: Utility functions.

## Getting Started
1. Install dependencies: `npm install`
2. Run development server: `npm run dev`
3. Build for production: `npm run build`
