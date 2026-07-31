"use client";

import { forwardRef } from "react";
import { BaseButton, SignInWithIdentityProviderProps } from "./base-button";

export const SignInWithGeneric = forwardRef<HTMLButtonElement, SignInWithIdentityProviderProps>(
  function SignInWithGeneric(props, ref) {
    const { children, logoUrl, name = "", className = "h-[50px]", ...restProps } = props;
    return (
      <BaseButton {...restProps} ref={ref} className={className}>
        {children ? (
          children
        ) : (
          <>
            {logoUrl && (
              <div className="flex size-12 shrink-0 items-center justify-center p-[10px]">
                <img
                  src={logoUrl}
                  alt={`${name} logo`}
                  className="max-h-full max-w-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
            <span className={logoUrl ? "ml-4" : "w-full text-center"}>{name}</span>
          </>
        )}
      </BaseButton>
    );
  },
);
