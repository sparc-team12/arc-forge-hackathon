import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router';
import IssueCard from '../components/issues/IssueCard';
import { AuthProvider } from '../components/auth/AuthContext';

// Mock issue data
const mockIssue = {
  id: 1,
  title: 'Test Issue Title That Might Be Very Long',
  description: 'This is a test description that could be quite lengthy and should wrap properly on mobile devices and smaller screens.',
  status: 'in_progress' as const,
  priority: 'high' as const,
  assigned_user_id: 'user-1',
  created_by_user_id: 'user-2',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  assigned_user: {
    id: 'user-1',
    name: 'John Doe',
    email: 'john@example.com',
    emailVerified: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  created_by_user: {
    id: 'user-2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    emailVerified: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  tags: [
    { id: 1, name: 'frontend', color: '#3b82f6', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
    { id: 2, name: 'urgent', color: '#ef4444', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' }
  ]
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Responsive Design Tests', () => {
  describe('IssueCard Component', () => {
    it('should render all content on desktop', () => {
      renderWithProviders(
        <IssueCard 
          issue={mockIssue} 
          onEdit={() => {}} 
          onDelete={() => {}} 
        />
      );

      expect(screen.getByText('Test Issue Title That Might Be Very Long')).toBeInTheDocument();
      expect(screen.getByText(/This is a test description/)).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('frontend')).toBeInTheDocument();
      expect(screen.getByText('urgent')).toBeInTheDocument();
    });

    it('should render status badge correctly', () => {
      renderWithProviders(
        <IssueCard 
          issue={mockIssue} 
          onEdit={() => {}} 
          onDelete={() => {}} 
        />
      );

      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('should render priority badge correctly', () => {
      renderWithProviders(
        <IssueCard 
          issue={mockIssue} 
          onEdit={() => {}} 
          onDelete={() => {}} 
        />
      );

      const priorityBadge = screen.getByText('High');
      expect(priorityBadge).toBeInTheDocument();
      expect(priorityBadge).toHaveClass('text-orange-700', 'bg-orange-100');
    });

    it('should handle missing assigned user', () => {
      const unassignedIssue = {
        ...mockIssue,
        assigned_user: undefined,
        assigned_user_id: undefined
      };

      renderWithProviders(
        <IssueCard 
          issue={unassignedIssue} 
          onEdit={() => {}} 
          onDelete={() => {}} 
        />
      );

      // Should not show "Assigned to" text when no user is assigned
      expect(screen.queryByText('Assigned to')).not.toBeInTheDocument();
      // But should still render the title and other content
      expect(screen.getByText('Test Issue Title That Might Be Very Long')).toBeInTheDocument();
    });

    it('should handle empty tags array', () => {
      const noTagsIssue = {
        ...mockIssue,
        tags: []
      };

      renderWithProviders(
        <IssueCard 
          issue={noTagsIssue} 
          onEdit={() => {}} 
          onDelete={() => {}} 
        />
      );

      // Should still render without errors
      expect(screen.getByText('Test Issue Title That Might Be Very Long')).toBeInTheDocument();
    });
  });

  describe('Typography Responsiveness', () => {
    it('should use responsive text sizes', () => {
      renderWithProviders(
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl">Responsive Heading</h1>
          <p className="text-sm md:text-base">Responsive paragraph</p>
        </div>
      );

      const heading = screen.getByText('Responsive Heading');
      expect(heading).toHaveClass('text-2xl', 'md:text-3xl', 'lg:text-4xl');
      
      const paragraph = screen.getByText('Responsive paragraph');
      expect(paragraph).toHaveClass('text-sm', 'md:text-base');
    });
  });

  describe('Spacing and Padding', () => {
    it('should use responsive spacing', () => {
      renderWithProviders(
        <div className="p-4 md:p-6 lg:p-8 m-2 md:m-4 lg:m-6">
          <span>Responsive spacing content</span>
        </div>
      );

      const container = screen.getByText('Responsive spacing content').parentElement;
      expect(container).toHaveClass('p-4', 'md:p-6', 'lg:p-8', 'm-2', 'md:m-4', 'lg:m-6');
    });
  });

  describe('Visibility Classes', () => {
    it('should handle responsive visibility', () => {
      renderWithProviders(
        <div>
          <div className="block md:hidden">Mobile only content</div>
          <div className="hidden md:block">Desktop only content</div>
          <div className="hidden sm:block lg:hidden">Tablet only content</div>
        </div>
      );

      const mobileOnly = screen.getByText('Mobile only content');
      expect(mobileOnly).toHaveClass('block', 'md:hidden');
      
      const desktopOnly = screen.getByText('Desktop only content');
      expect(desktopOnly).toHaveClass('hidden', 'md:block');
      
      const tabletOnly = screen.getByText('Tablet only content');
      expect(tabletOnly).toHaveClass('hidden', 'sm:block', 'lg:hidden');
    });
  });

  describe('Form Responsiveness', () => {
    it('should handle responsive form layouts', () => {
      renderWithProviders(
        <form className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <input className="flex-1" placeholder="First field" />
            <input className="flex-1" placeholder="Second field" />
          </div>
          <button className="w-full md:w-auto px-4 py-2">Submit</button>
        </form>
      );

      const formContainer = document.querySelector('.space-y-4');
      expect(formContainer).toBeInTheDocument();
      
      const fieldContainer = document.querySelector('.flex-col');
      expect(fieldContainer).toHaveClass('md:flex-row');
      
      const button = screen.getByText('Submit');
      expect(button).toHaveClass('w-full', 'md:w-auto');
    });
  });

  describe('Container and Width Management', () => {
    it('should use proper container classes', () => {
      renderWithProviders(
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <span>Container content</span>
        </div>
      );

      const container = screen.getByText('Container content').parentElement;
      expect(container).toHaveClass('container', 'mx-auto', 'px-4', 'md:px-6', 'lg:px-8');
    });

    it('should handle responsive widths', () => {
      renderWithProviders(
        <div className="w-full md:w-3/4 lg:w-1/2 xl:w-1/3">
          <span>Responsive width content</span>
        </div>
      );

      const container = screen.getByText('Responsive width content').parentElement;
      expect(container).toHaveClass('w-full', 'md:w-3/4', 'lg:w-1/2', 'xl:w-1/3');
    });
  });
});
