"use client";

export default function LoadingScreen() {
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-black text-white">
      <div className="text-center space-y-6">
        {/* Logo / Title */}
        <h1 className="text-5xl font-extrabold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
          Click Game
        </h1>

        {/* Subtitle */}
        <p className="text-gray-400 text-lg animate-pulse">
          Loading your experience...
        </p>

        {/* Spinner */}
        <div className="flex justify-center">
          <div className="relative w-16 h-16">
            {/* Outer glow ring */}
            <div className="absolute inset-0 rounded-full border-4 border-gray-700"></div>

            {/* Animated spinner */}
            <div className="absolute inset-0 rounded-full border-4 border-t-white border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden mx-auto">
          <div className="h-full bg-white animate-[loadingBar_2s_linear_infinite]"></div>
        </div>
      </div>

      {/* Custom animation */}
      <style jsx>{`
        @keyframes loadingBar {
          0% {
            transform: translateX(-100%);
            width: 40%;
          }
          50% {
            transform: translateX(50%);
            width: 60%;
          }
          100% {
            transform: translateX(100%);
            width: 40%;
          }
        }
      `}</style>
    </div>
  );
}
