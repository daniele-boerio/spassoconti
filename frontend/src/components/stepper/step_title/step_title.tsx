import "./step_title.scss";

export interface StepTitle {
  title: string;
  subtitle?: string;
}

export const StepTitle: React.FC<StepTitle> = ({ title, subtitle }) => {
  return (
    <div className="step-title-container">
      <div className="title">{title}</div>
      {subtitle && <div className="subtitle">{subtitle}</div>}
    </div>
  );
};

export default StepTitle;
