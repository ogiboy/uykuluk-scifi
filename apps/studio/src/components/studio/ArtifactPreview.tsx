type ArtifactPreviewProps = Readonly<{ children: string }>;

/**
 * Renders a bounded monospace preview of a persisted local artifact.
 *
 * @param children - The artifact excerpt to show.
 */
export function ArtifactPreview({ children }: ArtifactPreviewProps) {
  return (
    <pre className='bg-background/70 text-foreground ring-border/10 max-h-56 overflow-auto rounded-md p-3 font-mono text-xs leading-6 break-words whitespace-pre-wrap ring-1'>
      {children}
    </pre>
  );
}
