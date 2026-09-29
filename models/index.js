const { DataTypes } = require('sequelize');

module.exports = function defineModels(sequelize) {
  const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    email: { type: DataTypes.STRING(254), allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING(60), allowNull: false },
  }, {
    tableName: 'users',
    defaultScope: { attributes: { exclude: ['passwordHash'] } },
    scopes: { withPassword: { attributes: ['id', 'name', 'email', 'passwordHash'] } },
  });

  const Appointment = sequelize.define('Appointment', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    time: { type: DataTypes.TIME, allowNull: false },
    responsible: { type: DataTypes.STRING(120), allowNull: false },
    description: { type: DataTypes.STRING(1000), allowNull: true, defaultValue: null },
    status: {
      type: DataTypes.ENUM('scheduled', 'cancelled'),
      allowNull: false,
      defaultValue: 'scheduled',
    },
    userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  }, {
    tableName: 'appointments',
    indexes: [{ fields: ['userId', 'date', 'time'] }],
  });

  User.hasMany(Appointment, { foreignKey: 'userId', onDelete: 'RESTRICT' });
  Appointment.belongsTo(User, { foreignKey: 'userId', onDelete: 'RESTRICT' });
  return { User, Appointment };
};
