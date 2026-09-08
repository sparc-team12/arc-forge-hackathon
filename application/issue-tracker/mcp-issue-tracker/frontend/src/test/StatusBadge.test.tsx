import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import StatusBadge from '@/components/common/StatusBadge';
import type { Issue } from '@/types';

// Helper function to render components with router
const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('StatusBadge Component', () => {
  it('should render status badge with correct text', () => {
    renderWithRouter(<StatusBadge status="not_started" />);
    
    expect(screen.getByText('Not Started')).toBeInTheDocument();
  });

  it('should render different status values', () => {
    const { rerender } = renderWithRouter(<StatusBadge status="in_progress" />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    
    rerender(<BrowserRouter><StatusBadge status="done" /></BrowserRouter>);
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('should handle undefined status gracefully', () => {
    // Test with type assertion for testing undefined behavior
    renderWithRouter(<StatusBadge status={(undefined as unknown) as Issue["status"]} />);
    expect(screen.getByText('Not Started')).toBeInTheDocument();
  });

  it('should apply correct CSS classes', () => {
    renderWithRouter(<StatusBadge status="not_started" />);
    
    const badge = screen.getByText('Not Started');
    expect(badge).toHaveClass('bg-green-100', 'text-green-800');
  });
});
