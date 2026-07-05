type ArtifactPreviewProps = Readonly<{
  children: string;
}>;

/**
 * Renders a bounded monospace preview of a persisted local artifact.
 *
 * @param children - The artifact excerpt to show.
 */
export function ArtifactPreview({ children }: ArtifactPreviewProps) {
  return (
    <pre className='max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted p-3 font-mono text-xs leading-6 text-foreground'>
      {children}
    </pre>
  );
}
