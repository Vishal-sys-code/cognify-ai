export const Footer = () => {
  return (
    <footer>
      <div className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-4">
        <div className="glass-card flex h-14 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Cognify.AI • Research-grade AI
            visualization
          </p>
        </div>
      </div>
    </footer>
  );
};