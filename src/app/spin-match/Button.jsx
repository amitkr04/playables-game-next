"use client";
import React, { useState } from "react";

const SvgLoader = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 50 50"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="25"
      cy="25"
      r="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeDasharray="31.4 31.4"
    >
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 25 25"
        to="360 25 25"
        dur="1s"
        repeatCount="indefinite"
      />
    </circle>
  </svg>
);

const Button = ({
  onClick,
  children,
  disabled = false,
  showLoader = false,
  title = "",
  className = "",
  shadowColor = "#00000033",
  containerClass = "",
  type = "",
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const isInactive = disabled || isLoading;

  const handleClick = async (e) => {
    if (isInactive || !onClick) return;

    if (showLoader) setIsLoading(true);

    try {
      await onClick(e);
    } catch (error) {
      console.error("Action failed:", error);
    } finally {
      if (showLoader) {
        setIsLoading(false);
      }
    }
  };

  return (
    <span
      className={`inline-block relative ${containerClass} ${
        isInactive ? "cursor-not-allowed" : ""
      }`}
    >
      <button
        type={type}
        onClick={handleClick}
        disabled={isInactive}
        title={title}
        className={`relative group outline-none border-none bg-transparent p-0 ${
          isInactive ? "pointer-events-none" : "cursor-pointer"
        }`}
      >
        {/* BOTTOM SHADOW */}
        <span
          style={{ backgroundColor: shadowColor }}
          className={`absolute top-0 left-0 w-full h-full rounded-md translate-y-0.5 border border-black/20 transition-opacity ${
            isInactive ? "opacity-0" : "opacity-100"
          }`}
        />

        <span
          className={`
          relative block 
          ${className}
          font-semibold rounded-md
          transition-all duration-75 ease-out
          ${
            isInactive
              ? "translate-y-0 opacity-80  brightness-90 shadow-none"
              : "-translate-y-0.5  group-active:translate-y-0.5 hover:brightness-110 shadow-sm"
          }
         
          overflow-hidden
        `}
        >
          <span className="relative z-10 flex items-center justify-center gap-2 drop-shadow-sm min-h-5">
            {isLoading && showLoader ? <SvgLoader /> : children}
          </span>

          {/* GLASS SHINE */}
          {!isInactive && (
            <span className="absolute inset-0 w-full h-full pointer-events-none">
              <span className="absolute top-0 -left-full w-1/2 h-full bg-linear-to-r from-transparent via-white/40 to-transparent skew-x-[-25deg] transition-all duration-1000 group-hover:left-[160%]" />
            </span>
          )}
        </span>
      </button>
    </span>
  );
};

export default Button;
